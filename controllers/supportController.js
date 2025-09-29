const SupportTicket = require('../models/Support');
const User = require('../models/User');
const { sendEmail } = require('../utils/mailer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose'); // Added mongoose import

// Create a new support ticket
exports.createTicket = async (req, res, next) => {
  try {
    const { subject, priority, message, appVersion, deviceInfo } = req.body;
    const userId = req.user.id;
    
    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Generate ticket number first
    let ticketNumber;
    try {
      const Counter = mongoose.model('Counter');
      const counter = await Counter.findOneAndUpdate(
        { name: 'supportTicketNumber' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      ticketNumber = `TKT${String(counter.seq).padStart(6, '0')}`;
    } catch (error) {
      console.error('Counter error, using fallback:', error);
      // Fallback: timestamp + random number
      ticketNumber = `TKT${Date.now()}${Math.floor(Math.random() * 1000)}`;
    }
    
    // Create support ticket
    const supportTicket = new SupportTicket({
      userId,
      subject,
      priority: priority || 'Medium',
      messages: [{
        sender: 'user',
        content: message
      }],
      userInfo: {
        appVersion: appVersion || '1.0.0',
        deviceInfo: deviceInfo || 'Unknown',
        os: process.platform
      },
      ticketNumber // Add the generated ticket number
    });
    
    // Handle file uploads if any
    if (req.files && req.files.length > 0) {
      supportTicket.messages[0].attachments = req.files.map(file => ({
        filename: file.filename,
        path: file.path,
        originalName: file.originalname
      }));
    }
    
    await supportTicket.save();
    
    // Send confirmation email
    try {
      await sendEmail(
        user.email,
        `Support Ticket Created: ${supportTicket.ticketNumber}`,
        'supportTicketConfirmation',
        {
          name: user.name,
          ticketNumber: supportTicket.ticketNumber,
          subject: supportTicket.subject,
          message: message,
          priority: supportTicket.priority
        }
      );
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue even if email fails
    }
    
    res.status(201).json({
      message: 'Support ticket created successfully',
      ticket: supportTicket
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    next(error);
  }
};

// Get user's support tickets
exports.getUserTickets = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const tickets = await SupportTicket.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await SupportTicket.countDocuments({ userId });
    
    res.json({
      tickets,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalTickets: total
    });
  } catch (error) {
    next(error);
  }
};

// Get a specific ticket
exports.getTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;
    
    const ticket = await SupportTicket.findOne({
      _id: ticketId,
      userId
    });
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    res.json({ ticket });
  } catch (error) {
    next(error);
  }
};

// Add a message to a ticket
exports.addMessage = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    
    const ticket = await SupportTicket.findOne({
      _id: ticketId,
      userId
    });
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
      return res.status(400).json({ message: 'Cannot add message to a resolved or closed ticket' });
    }
    
    const newMessage = {
      sender: 'user',
      content
    };
    
    // Handle file uploads if any
    if (req.files && req.files.length > 0) {
      newMessage.attachments = req.files.map(file => ({
        filename: file.filename,
        path: file.path,
        originalName: file.originalname
      }));
    }
    
    ticket.messages.push(newMessage);
    ticket.updatedAt = new Date();
    await ticket.save();
    
    res.json({
      message: 'Message added successfully',
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// Get all tickets (admin only)
exports.getAllTickets = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status, priority } = req.query;
    
    let filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    
    const tickets = await SupportTicket.find(filter)
      .populate('userId', 'name email pharmacyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await SupportTicket.countDocuments(filter);
    
    res.json({
      tickets,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalTickets: total
    });
  } catch (error) {
    next(error);
  }
};

// Update ticket status (admin only)
exports.updateTicketStatus = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { ticketId } = req.params;
    const { status } = req.body;
    
    const ticket = await SupportTicket.findById(ticketId).populate('userId', 'email name');
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    ticket.status = status;
    ticket.updatedAt = new Date();
    
    if (status === 'Resolved' || status === 'Closed') {
      ticket.resolvedAt = new Date();
    }
    
    await ticket.save();
    
    // Send status update email to user
    try {
      await sendEmail(
        ticket.userId.email,
        `Support Ticket Update: ${ticket.ticketNumber}`,
        'supportStatusUpdate',
        {
          name: ticket.userId.name,
          ticketNumber: ticket.ticketNumber,
          status: status,
          subject: ticket.subject
        }
      );
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue even if email fails
    }
    
    res.json({
      message: 'Ticket status updated successfully',
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// Add admin response to ticket
exports.addAdminResponse = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { ticketId } = req.params;
    const { content } = req.body;
    
    const ticket = await SupportTicket.findById(ticketId).populate('userId', 'email name');
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    const newMessage = {
      sender: 'support',
      content
    };
    
    // Handle file uploads if any
    if (req.files && req.files.length > 0) {
      newMessage.attachments = req.files.map(file => ({
        filename: file.filename,
        path: file.path,
        originalName: file.originalname
      }));
    }
    
    ticket.messages.push(newMessage);
    ticket.updatedAt = new Date();
    
    // If ticket was closed and admin is responding, reopen it
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
      ticket.status = 'In Progress';
    }
    
    await ticket.save();
    
    // Send notification email to user
    try {
      await sendEmail(
        ticket.userId.email,
        `New Response on Support Ticket: ${ticket.ticketNumber}`,
        'supportResponse',
        {
          name: ticket.userId.name,
          ticketNumber: ticket.ticketNumber,
          message: content,
          subject: ticket.subject
        }
      );
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue even if email fails
    }
    
    res.json({
      message: 'Response added successfully',
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// Get support statistics (admin only)
exports.getSupportStats = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const totalTickets = await SupportTicket.countDocuments();
    const openTickets = await SupportTicket.countDocuments({ status: 'Open' });
    const inProgressTickets = await SupportTicket.countDocuments({ status: 'In Progress' });
    const resolvedTickets = await SupportTicket.countDocuments({ status: 'Resolved' });
    const closedTickets = await SupportTicket.countDocuments({ status: 'Closed' });
    
    const priorityStats = {
      Low: await SupportTicket.countDocuments({ priority: 'Low' }),
      Medium: await SupportTicket.countDocuments({ priority: 'Medium' }),
      High: await SupportTicket.countDocuments({ priority: 'High' }),
      Urgent: await SupportTicket.countDocuments({ priority: 'Urgent' })
    };
    
    const subjectStats = {
      'Technical Issue': await SupportTicket.countDocuments({ subject: 'Technical Issue' }),
      'Billing': await SupportTicket.countDocuments({ subject: 'Billing' }),
      'Account': await SupportTicket.countDocuments({ subject: 'Account' }),
      'Feature Request': await SupportTicket.countDocuments({ subject: 'Feature Request' }),
      'General Inquiry': await SupportTicket.countDocuments({ subject: 'General Inquiry' }),
      'Other': await SupportTicket.countDocuments({ subject: 'Other' })
    };
    
    res.json({
      totalTickets,
      statusStats: {
        Open: openTickets,
        'In Progress': inProgressTickets,
        Resolved: resolvedTickets,
        Closed: closedTickets
      },
      priorityStats,
      subjectStats
    });
  } catch (error) {
    next(error);
  }
};