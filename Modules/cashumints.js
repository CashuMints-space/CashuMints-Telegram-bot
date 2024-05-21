const axios = require('axios');
const { saveData, loadData } = require('./dataCache');

const fetchAndCacheData = async (url, cacheFilename) => {
    const cachedData = loadData(cacheFilename);
    if (cachedData) {
        return cachedData;
    }

    try {
        const response = await axios.get(url);
        saveData(cacheFilename, response.data);
        return response.data;
    } catch (error) {
        console.error(`Error fetching data from ${url}:`, error);
        return null;
    }
};

const getTopMints = async () => {
    return await fetchAndCacheData('https://cashumints.space/wp-json/public/top-liked-public/', 'top_mints.json');
};

const getTopWallets = async () => {
    return await fetchAndCacheData('https://cashumints.space/wp-json/public/top-liked-public/', 'top_wallets.json');
};

module.exports = { getTopMints, getTopWallets };
