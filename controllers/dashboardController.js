const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Request = require('../models/Request');
const Product = require('../models/Product');

exports.getDashboardData = async (req, res) => {
    try {
        const pharmacyId = req.user._id;
        const { startDate, endDate } = req.query;

        // Calculate date range (default: last 30 days)
        const defaultStartDate = new Date();
        defaultStartDate.setDate(defaultStartDate.getDate() - 30);
        const filterStartDate = startDate ? new Date(startDate) : defaultStartDate;
        const filterEndDate = endDate ? new Date(endDate) : new Date();

        // Get KPIs
        const [
            totalSales,
            lowStockItems,
            expiringMedications,
            pendingRequests,
            recentSales,
            recentActivity
        ] = await Promise.all([
            // Total Sales
            Sale.aggregate([
                {
                    $match: {
                        pharmacyId: pharmacyId,
                        createdAt: { $gte: filterStartDate, $lte: filterEndDate },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$totalAmount' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            
            // Low Stock Items
            Inventory.find({
                pharmacyId: pharmacyId,
                status: 'low_stock',
                quantity: { $gt: 0 }
            }).populate('productId', 'name category'),
            
            // Expiring Medications (within next 30 days)
            Inventory.find({
                pharmacyId: pharmacyId,
                expiryDate: { 
                    $lte: new Date(new Date().setDate(new Date().getDate() + 30)),
                    $gte: new Date()
                },
                quantity: { $gt: 0 }
            }).populate('productId', 'name'),
            
            // Pending Requests
            Request.countDocuments({
                pharmacyId: pharmacyId,
                status: 'pending'
            }),
            
            // Recent Sales (last 10)
            Sale.find({
                pharmacyId: pharmacyId
            })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('productId', 'name'),
            
            // Recent Activity (combined from sales and requests)
            Promise.all([
                Sale.find({ pharmacyId: pharmacyId })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .select('productName quantity totalAmount createdAt'),
                Request.find({ pharmacyId: pharmacyId })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .select('type title status createdAt')
            ]).then(([sales, requests]) => {
                return [...sales, ...requests]
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .slice(0, 10);
            })
        ]);

        // Format KPIs
        const kpiData = {
            totalSales: totalSales[0]?.totalAmount || 0,
            salesCount: totalSales[0]?.count || 0,
            lowStockCount: lowStockItems.length,
            expiringCount: expiringMedications.length,
            pendingRequestsCount: pendingRequests
        };

        res.status(200).json({
            success: true,
            data: {
                kpis: kpiData,
                lowStockItems: lowStockItems.slice(0, 5),
                expiringMedications: expiringMedications.slice(0, 5),
                recentSales: recentSales,
                recentActivity: recentActivity,
                quickActions: getQuickActions(req.user.role)
            }
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard data'
        });
    }
};

exports.createRequest = async (req, res) => {
    try {
        const pharmacyId = req.user._id;
        const { type, title, description, priority, dueDate } = req.body;

        const request = new Request({
            pharmacyId,
            type,
            title,
            description,
            priority,
            dueDate: dueDate ? new Date(dueDate) : null
        });

        await request.save();

        res.status(201).json({
            success: true,
            message: 'Request created successfully',
            data: request
        });

    } catch (error) {
        console.error('Create request error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating request'
        });
    }
};

exports.getNotifications = async (req, res) => {
    try {
        const pharmacyId = req.user._id;
        
        const [lowStock, expiringSoon, pendingRequests] = await Promise.all([
            Inventory.countDocuments({
                pharmacyId: pharmacyId,
                status: 'low_stock',
                quantity: { $gt: 0 }
            }),
            Inventory.countDocuments({
                pharmacyId: pharmacyId,
                expiryDate: { 
                    $lte: new Date(new Date().setDate(new Date().getDate() + 7)),
                    $gte: new Date()
                }
            }),
            Request.countDocuments({
                pharmacyId: pharmacyId,
                status: 'pending'
            })
        ]);

        res.status(200).json({
            success: true,
            data: {
                lowStock,
                expiringSoon,
                pendingRequests,
                total: lowStock + expiringSoon + pendingRequests
            }
        });

    } catch (error) {
        console.error('Notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notifications'
        });
    }
};

// Helper function for quick actions based on role
function getQuickActions(role) {
    const baseActions = [
        { id: 1, title: 'New Sale', icon: '💰', route: '/sales/new' },
        { id: 2, title: 'Add Product', icon: '📦', route: '/inventory/add' },
        { id: 3, title: 'Stock Check', icon: '🔍', route: '/inventory' },
        { id: 4, title: 'Reports', icon: '📊', route: '/reports' }
    ];

    const adminActions = [
        ...baseActions,
        { id: 5, title: 'Manage Users', icon: '👥', route: '/admin/users' },
        { id: 6, title: 'Settings', icon: '⚙️', route: '/settings' }
    ];

    return role === 'admin' ? adminActions : baseActions;
}