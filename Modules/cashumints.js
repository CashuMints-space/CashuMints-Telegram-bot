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
    const url = 'https://cashumints.space/wp-json/public/top-liked-public/';
    const cacheFilename = 'top_mints.json';
    return await fetchAndCacheData(url, cacheFilename);
};

module.exports = { getTopMints };
