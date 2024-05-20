const axios = require('axios');
const { saveData, loadData } = require('./dataCache');
require('dotenv').config();

const API_BASE_URL = 'https://cashumints.space/wp-json/public';

/**
 * Fetch data from a given endpoint and cache it locally.
 * @param {string} endpoint - The endpoint to fetch data from.
 * @param {string} cacheFilename - The filename to use for caching the data.
 * @returns {Promise<Object>} - The fetched data.
 */
const fetchData = async (endpoint, cacheFilename) => {
    const cachedData = loadData(cacheFilename);
    if (cachedData) {
        return cachedData;
    }

    try {
        const response = await axios.get(`${API_BASE_URL}/${endpoint}`);
        saveData(cacheFilename, response.data);
        return response.data;
    } catch (error) {
        console.error(`Error fetching data from ${endpoint}:`, error);
        return null;
    }
};

/**
 * Fetch the top liked mints.
 * @returns {Promise<Object>} - The top liked mints data.
 */
const getTopMints = async () => {
    return fetchData('top-liked-public/', 'top_mints.json');
};

/**
 * Fetch the top liked wallets.
 * @returns {Promise<Object>} - The top liked wallets data.
 */
const getTopWallets = async () => {
    return fetchData('top-liked-public/', 'top_wallets.json');
};

/**
 * Fetch general information from Cashumints.space API.
 * @param {string} endpoint - The specific endpoint to fetch data from.
 * @returns {Promise<Object>} - The fetched data.
 */
const fetchGeneralInfo = async (endpoint) => {
    return fetchData(endpoint, `${endpoint.replace(/\//g, '_')}.json`);
};

module.exports = {
    getTopMints,
    getTopWallets,
    fetchGeneralInfo
};
