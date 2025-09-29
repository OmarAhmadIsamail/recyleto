const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Utility function to ensure upload directory exists
const ensureUploadsDir = (subDir) => {
    const uploadDir = path.join(__dirname, `../uploads/${subDir}/`);
    try {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            console.log(`Created upload directory: ${uploadDir}`);
        }
        return uploadDir;
    } catch (error) {
        console.error('Error creating upload directory:', error);
        throw new Error('Failed to create upload directory');
    }
};

// Configure storage for licenses
const licenseStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        try {
            const uploadDir = ensureUploadsDir('licenses');
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeFilename = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
        cb(null, 'license-' + uniqueSuffix + path.extname(safeFilename));
    }
});

// Configure storage for logos
const logoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        try {
            const uploadDir = ensureUploadsDir('logos');
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeFilename = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
        cb(null, 'logo-' + uniqueSuffix + path.extname(safeFilename));
    }
});

// Configure storage for request images
const requestStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        try {
            const uploadDir = ensureUploadsDir('requests');
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeFilename = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
        cb(null, 'request-' + uniqueSuffix + path.extname(safeFilename));
    }
});

// Configure storage for support attachments
const supportStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        try {
            const uploadDir = ensureUploadsDir('support');
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeFilename = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
        cb(null, 'support-' + uniqueSuffix + path.extname(safeFilename));
    }
});

// Common file filter for images only
const imageFileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    
    if (file.mimetype.startsWith('image/') && allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WEBP, SVG)!'), false);
    }
};

// File filter for request images (more permissive)
const requestFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

// File filter for support attachments
const supportFileFilter = (req, file, cb) => {
    // Allow images and documents
    if (file.mimetype.startsWith('image/') || 
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        cb(null, true);
    } else {
        cb(new Error('Only images and documents are allowed'), false);
    }
};

// File filter for backward compatibility (licenseImage and logo fields)
const pharmacyFileFilter = (req, file, cb) => {
    if (file.fieldname === 'licenseImage' || file.fieldname === 'logo') {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    } else {
        cb(new Error('Invalid fieldname'), false);
    }
};

// Configure storage for backward compatibility
const pharmacyStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'licenseImage') {
            try {
                const uploadDir = ensureUploadsDir('licenses');
                cb(null, uploadDir);
            } catch (error) {
                cb(error);
            }
        } else if (file.fieldname === 'logo') {
            try {
                const uploadDir = ensureUploadsDir('logos');
                cb(null, uploadDir);
            } catch (error) {
                cb(error);
            }
        } else {
            cb(new Error('Invalid fieldname'), false);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Multer configurations
const uploadLicense = multer({
    storage: licenseStorage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1 // Limit to single file upload
    }
});

const uploadLogo = multer({
    storage: logoStorage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB limit
        files: 1
    }
});

const uploadRequest = multer({
    storage: requestStorage,
    fileFilter: requestFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

const uploadSupport = multer({
    storage: supportStorage,
    fileFilter: supportFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Backward compatible upload instance
const upload = multer({
    storage: pharmacyStorage,
    fileFilter: pharmacyFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 2 // Maximum 2 files
    }
});

// Enhanced error handling middleware
const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(413).json({
                    success: false,
                    message: 'File too large. Maximum size is 5MB'
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    success: false,
                    message: 'Too many files. Only one file allowed'
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    success: false,
                    message: 'Unexpected field name for file upload'
                });
            default:
                return res.status(400).json({
                    success: false,
                    message: 'File upload error occurred'
                });
        }
    } else if (error) {
        // Handle custom errors from fileFilter
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    next(error);
};

// Optional: Cleanup function for failed uploads
const cleanupUploadedFile = (req, res, next) => {
    if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error cleaning up file:', err);
        });
    }
    next();
};

// Combined middleware for both files (license and logo)
const uploadPharmacyFiles = (req, res, next) => {
    // Use multer for both files
    const licenseUpload = uploadLicense.single('license');
    const logoUpload = uploadLogo.single('logo');
    
    licenseUpload(req, res, function(err) {
        if (err) return next(err);
        
        logoUpload(req, res, function(err) {
            if (err) return next(err);
            next();
        });
    });
};

// Backward compatibility - pharmacyUpload for licenseImage and logo fields
const pharmacyUpload = upload.fields([
    { name: 'licenseImage', maxCount: 1 },
    { name: 'logo', maxCount: 1 }
]);

module.exports = { 
    // New enhanced uploads
    uploadPharmacyFiles,
    uploadLicense: uploadLicense.single('license'),
    uploadLogo: uploadLogo.single('logo'),
    uploadRequest: uploadRequest.single('image'),
    uploadSupport: uploadSupport.single('attachment'),
    handleMulterError, 
    cleanupUploadedFile,
    
    // Backward compatibility
    upload,
    pharmacyUpload
};