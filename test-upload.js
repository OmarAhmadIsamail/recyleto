const fs = require('fs');
const path = require('path');

// Test if uploads directory is created
const testDirectories = () => {
    const requiredDirs = [
        'uploads',
        'uploads/licenses'
    ];

    requiredDirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            console.error(`❌ Directory missing: ${dir}`);
        } else {
            console.log(`✅ Directory exists: ${dir}`);
        }
    });

    // Test write permissions
    const testFile = 'uploads/test-write.txt';
    try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log('✅ Write permissions: OK');
    } catch (error) {
        console.error('❌ Write permissions: FAILED');
    }
};

testDirectories();