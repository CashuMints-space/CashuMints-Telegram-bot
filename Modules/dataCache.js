const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const cacheFilePath = (filename) => path.join(dataDir, filename);

const saveData = (filename, data) => {
    const filePath = cacheFilePath(filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`[INFO] Data saved to ${filePath}`);
};

const loadData = (filename) => {
    const filePath = cacheFilePath(filename);
    if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath));
        console.log(`[INFO] Data loaded from ${filePath}`);
        return data;
    }
    return null;
};

// New functions to handle pending tokens
const savePendingTokens = (pendingTokens) => {
    saveData('pendingTokens.json', pendingTokens);
};

const loadPendingTokens = () => {
    return loadData('pendingTokens.json') || [];
};

module.exports = { saveData, loadData, savePendingTokens, loadPendingTokens };
