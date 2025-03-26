// utils/fileUpload.js
const fs = require('fs');
const path = require('path');

const deleteFile = async (filePath) => {
    try {
        await fs.promises.unlink(path.join(__dirname, '..', filePath));
    } catch (error) {
        console.error('Error deleting file:', error);
    }
};

const createUploadDirs = () => {
    const dirs = ['uploads', 'uploads/jobs', 'uploads/profiles'];
    
    dirs.forEach(dir => {
        const dirPath = path.join(__dirname, '..', dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    });
};

module.exports = {
    deleteFile,
    createUploadDirs
};