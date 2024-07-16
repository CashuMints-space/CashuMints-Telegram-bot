const axios = require('axios');
const { saveData, loadData } = require('./dataCache');
const logger = require('../logger');

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
        logger.error(`Error fetching data from ${url}:`, error);
        return null;
    }
};

const getTopMints = async () => {
    return await fetchAndCacheData('https://cashumints.space/wp-json/public/top-liked-public/', 'top_mints.json');
};

module.exports = { getTopMints };
