const { CashuMint, CashuWallet, getDecodedToken } = require('@cashu/cashu-ts');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const messages = require('../messages');
const axios = require('axios');
const Jimp = require('jimp'); // Add Jimp for image processing
const { savePendingTokens, loadPendingTokens, saveMintUrls, loadMintUrls } = require('./dataCache');
const logger = require('../logger');

require('dotenv').config();

const qrCodeDir = './qrcodes';
const debugMode = process.env.DEBUG_MODE === 'true';
const timeoutMinutes = parseInt(process.env.TIMEOUT_MINUTES) || 2;
const checkIntervalSeconds = parseInt(process.env.CHECK_INTERVAL_SECONDS) || 5;
const claimedDisposeTiming = parseInt(process.env.CLAIMED_DISPOSE_TIMING) || 10;

const cashuApiUrl = process.env.CASHU_API_URL;

if (!fs.existsSync(qrCodeDir)) {
    fs.mkdirSync(qrCodeDir);
}

// Function to check if the Cashu token has been spent
async function checkTokenStatus(tokenEncoded) {
    try {
        const token = getDecodedToken(tokenEncoded);
        const mintUrl = token.token[0].mint;
        const proofs = token.token[0].proofs;

        const mint = new CashuMint(mintUrl);
        const keys = await mint.getKeys();
        const wallet = new CashuWallet(mint, keys);

        const spentProofs = await wallet.checkProofsSpent(proofs);
        return spentProofs.length === proofs.length ? 'spent' : 'pending';
    } catch (error) {
        logger.error('Error checking token:', error);
        throw error;
    }
}

// Function to generate a high-quality QR code for the token
async function generateQRCode(token) {
    const qrCodeImagePath = path.join(qrCodeDir, `${Date.now()}.png`);
    const cashuIconPath = path.join(__dirname, '../cashu.png');

    await QRCode.toFile(qrCodeImagePath, token, {
        errorCorrectionLevel: 'H',
        width: 1920
    });

    const qrCodeImage = await Jimp.read(qrCodeImagePath);
    const cashuIcon = await Jimp.read(cashuIconPath);

    // Resize the icon to fit in the middle of the QR code but not too large
    cashuIcon.resize(120, 120);
    const x = (qrCodeImage.bitmap.width / 2) - (cashuIcon.bitmap.width / 2);
    const y = (qrCodeImage.bitmap.height / 2) - (cashuIcon.bitmap.height / 2);

    qrCodeImage.composite(cashuIcon, x, y, {
        mode: Jimp.BLEND_SOURCE_OVER,
        opacitySource: 1,
        opacityDest: 1
    });

    await qrCodeImage.writeAsync(qrCodeImagePath);

    return qrCodeImagePath;
}

// Function to delete the QR code image
function deleteQRCode(filePath) {
    fs.unlink(filePath, (err) => {
        if (err) logger.error(`Error deleting file ${filePath}:`, err);
    });
}

// Function to fetch mint data from the URL
async function fetchMintData(mintUrl) {
    const cachedMintUrls = loadMintUrls();
    if (cachedMintUrls[mintUrl]) {
        return cachedMintUrls[mintUrl];
    }

    try {
        const response = await axios.get('https://cashumints.space/wp-json/cashumints/all-cashu-mints/');
        const mints = response.data;

        // Create a map of mint URLs to mint data
        const mintMap = mints.reduce((map, mint) => {
            map[mint.mint_url] = mint;
            return map;
        }, {});

        // Save the mint URLs to the cache
        saveMintUrls(mintMap);

        return mintMap[mintUrl];
    } catch (error) {
        logger.error('Error fetching mint data:', error);
        return null;
    }
}

async function handleMessage(bot, msg, cashuApiUrl, claimedDisposeTiming) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    try {
        // Check if the token has been spent before processing
        const status = await checkTokenStatus(text);
        if (status === 'spent') {
            if (debugMode) logger.info(`Token already spent: ${text}`);
            return; // Do not process further if the token is already spent
        }

        // Decode the token to check if it's valid
        const decodedToken = getDecodedToken(text);

        // Fetch mint data
        const mintData = await fetchMintData(decodedToken.token[0].mint);
        const mintName = mintData ? mintData.mint_name : 'Unknown Mint';
        const mintLink = mintData ? `https://cashumints.space/?p=${mintData.cct_single_post_id}` : '#';

        // Generate high-quality QR code
        const qrCodePath = await generateQRCode(text);

        // Send the QR code message
        const qrMessage = await bot.sendPhoto(chatId, qrCodePath, {}, {
            filename: 'cashu-token.png',
            contentType: 'image/png'
        });

        // Send the status message
        const statusMessage = await bot.sendMessage(chatId, messages.pendingMessage(username, mintName, mintLink, `${cashuApiUrl}?token=${text}`), {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [[{ text: 'Rate Mint', url: mintLink }]]
            }
        });

        let tokenSpent = false;

        // Save the pending token details
        const pendingTokens = loadPendingTokens();
        pendingTokens.push({
            encoded: text,
            username: username,
            messageId: statusMessage.message_id,
            chatId: chatId
        });
        savePendingTokens(pendingTokens);

        // Function to update the message status
        const updateMessageStatus = async () => {
            if (tokenSpent) return; // Stop updating if token is already spent
            try {
                const currentStatus = await checkTokenStatus(text);
                if (currentStatus === 'spent') {
                    tokenSpent = true;

                    // Delete the QR code message and update the status message
                    await bot.deleteMessage(chatId, qrMessage.message_id);

                    // Avoid updating the message with the same content and markup
                    const newMessage = messages.claimedMessage(username);
                    if (newMessage !== statusMessage.text) {
                        await bot.editMessageText(newMessage, {
                            chat_id: chatId,
                            message_id: statusMessage.message_id,
                            parse_mode: 'Markdown',
                            disable_web_page_preview: true,
                        });

                        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                            chat_id: chatId,
                            message_id: statusMessage.message_id
                        });
                    }

                    // Schedule deletion of the claimed message after the specified time
                    setTimeout(() => {
                        bot.deleteMessage(chatId, statusMessage.message_id);
                    }, claimedDisposeTiming * 60000);

                    // Delete the QR code file
                    deleteQRCode(qrCodePath);
                    // Clear the interval
                    clearInterval(intervalId);

                    // Remove the token from pending tokens
                    const updatedPendingTokens = loadPendingTokens().filter(token => token.encoded !== text);
                    savePendingTokens(updatedPendingTokens);
                }
            } catch (error) {
                if (error.message.includes('Rate limit exceeded')) {
                    logger.error('Rate limit exceeded. Pausing updates for this message.');
                    clearInterval(intervalId);
                    setTimeout(() => {
                        logger.info('Resuming updates after timeout.');
                        intervalId = setInterval(updateMessageStatus, checkIntervalSeconds * 1000);
                    }, timeoutMinutes * 60000);
                } else if (error.code !== 'ETELEGRAM' || !error.response || error.response.description !== 'Bad Request: message is not modified') {
                    logger.error('Error updating message status:', error);
                }
            }
        };

        // Set interval to check the token status every 5 seconds
        let intervalId = setInterval(updateMessageStatus, checkIntervalSeconds * 1000);

        // Delete the original token message if it's a valid token
        await bot.deleteMessage(chatId, msg.message_id);

    } catch (error) {
        if (error.message.includes('Timeout pinging that mint')) {
            logger.error('Timeout occurred while pinging the mint:', error);
            setTimeout(() => {
                logger.info('Resuming processing after timeout.');
                handleMessage(bot, msg, cashuApiUrl, claimedDisposeTiming);
            }, timeoutMinutes * 60000);
        } else {
            logger.error('Error processing message:', error);
            // Send error message if token is invalid
            await bot.sendMessage(chatId, messages.errorMessage);
        }
    }
}

// Function to check pending tokens on startup
async function checkPendingTokens(bot) {
    try {
        const pendingTokens = loadPendingTokens();

        for (const token of pendingTokens) {
            const status = await checkTokenStatus(token.encoded);
            if (status === 'spent') {
                const newMessage = messages.claimedMessage(token.username);
                const messageId = token.messageId;
                const chatId = token.chatId;

                await bot.editMessageText(newMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                });

                await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                    chat_id: chatId,
                    message_id: messageId
                });

                // Schedule deletion of the claimed message after the specified time
                setTimeout(() => {
                    bot.deleteMessage(chatId, messageId);
                }, claimedDisposeTiming * 60000);

                // Remove the token from pending tokens
                const updatedPendingTokens = loadPendingTokens().filter(pendingToken => pendingToken.encoded !== token.encoded);
                savePendingTokens(updatedPendingTokens);
            }
        }
    } catch (error) {
        logger.error('Error checking pending tokens on startup:', error);
    }
}

module.exports = { handleMessage, checkTokenStatus, generateQRCode, deleteQRCode, checkPendingTokens };
