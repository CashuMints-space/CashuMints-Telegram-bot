const { CashuMint, CashuWallet, getDecodedToken } = require('@cashu/cashu-ts');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const messages = require('../messages');
const { saveData, loadData } = require('./dataCache');

require('dotenv').config();

const qrCodeDir = './qrcodes';
const tokenQueueFile = path.join(__dirname, '../data/tokenQueue.json');
const maxRetries = 3;
const defaultRetryInterval = parseInt(process.env.TIMEOUT_MINUTES) * 60 * 1000;

if (!fs.existsSync(qrCodeDir)) {
    fs.mkdirSync(qrCodeDir);
}

if (!fs.existsSync(tokenQueueFile)) {
    fs.writeFileSync(tokenQueueFile, JSON.stringify({}));
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
        const status = spentProofs.length === proofs.length ? 'spent' : 'pending';
        return status;
    } catch (error) {
        console.error('Error checking token:', error);
        throw error;
    }
}

// Function to generate a QR code for the token
async function generateQRCode(token) {
    const filePath = path.join(qrCodeDir, `${Date.now()}.png`);
    await QRCode.toFile(filePath, token);
    return filePath;
}

// Function to delete the QR code image
function deleteQRCode(filePath) {
    fs.unlink(filePath, (err) => {
        if (err) console.error(`Error deleting file ${filePath}:`, err);
    });
}

// Function to save the token queue to a JSON file
function saveTokenQueue(tokenQueue) {
    saveData('tokenQueue.json', tokenQueue);
}

// Function to load the token queue from a JSON file
function loadTokenQueue() {
    return loadData('tokenQueue.json') || {};
}

const handleTokenQueue = async (bot, mintUrl, tokenData, cashuApiUrl, claimedDisposeTiming, timeoutMinutes, checkIntervalSeconds, mintQueues) => {
    if (!mintQueues[mintUrl]) {
        mintQueues[mintUrl] = [];
    }

    mintQueues[mintUrl].push(tokenData);

    if (mintQueues[mintUrl].length > 1) {
        return;
    }

    const tokenQueue = loadTokenQueue();
    tokenQueue[mintUrl] = mintQueues[mintUrl];
    saveTokenQueue(tokenQueue);

    while (mintQueues[mintUrl].length > 0) {
        const { chatId, msg, qrCodePath, statusMessage, username, retryCount } = mintQueues[mintUrl][0];
        let tokenSpent = false;

        const updateMessageStatus = async () => {
            if (tokenSpent) return;
            try {
                const currentStatus = await checkTokenStatus(msg.text);
                if (currentStatus === 'spent') {
                    tokenSpent = true;

                    await bot.deleteMessage(chatId, qrCodePath);
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

                    setTimeout(() => {
                        bot.deleteMessage(chatId, statusMessage.message_id);
                    }, claimedDisposeTiming * 60000);

                    deleteQRCode(qrCodePath);
                    clearInterval(intervalId);
                    mintQueues[mintUrl].shift();
                    const tokenQueue = loadTokenQueue();
                    tokenQueue[mintUrl] = mintQueues[mintUrl];
                    saveTokenQueue(tokenQueue);
                    if (mintQueues[mintUrl].length > 0) {
                        handleTokenQueue(bot, mintUrl, mintQueues[mintUrl][0], cashuApiUrl, claimedDisposeTiming, timeoutMinutes, checkIntervalSeconds, mintQueues);
                    }
                }
            } catch (error) {
                if (error.status === 429) {
                    console.error('Rate limit exceeded. Retrying after timeout.');
                    clearInterval(intervalId);
                    const nextRetryCount = (retryCount || 0) + 1;
                    const nextRetryInterval = Math.min(defaultRetryInterval * Math.pow(2, nextRetryCount), 24 * 60 * 60 * 1000); // Exponential backoff up to 24 hours
                    setTimeout(() => {
                        mintQueues[mintUrl][0].retryCount = nextRetryCount;
                        updateMessageStatus();
                    }, nextRetryInterval);
                } else if (error.code !== 'ETELEGRAM' || !error.response || error.response.description !== 'Bad Request: message is not modified') {
                    console.error('Error updating message status:', error);
                }
            }
        };

        const intervalId = setInterval(updateMessageStatus, checkIntervalSeconds * 1000);
        mintQueues[mintUrl].intervalId = intervalId;
    }
};

async function handleMessage(bot, msg, cashuApiUrl, claimedDisposeTiming, timeoutMinutes, checkIntervalSeconds, mintQueues) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    try {
        const status = await checkTokenStatus(text);
        if (status === 'spent') {
            console.log(`[INFO] Token already spent: ${text}`);
            return;
        }

        const decodedToken = getDecodedToken(text);
        const mintUrl = decodedToken.token[0].mint;

        const qrCodePath = await generateQRCode(text);
        const qrMessage = await bot.sendPhoto(chatId, qrCodePath, {}, {
            filename: 'cashu-token.png',
            contentType: 'image/png'
        });

        const statusMessage = await bot.sendMessage(chatId, messages.pendingMessage(username, cashuApiUrl), {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [[{ text: messages.tokenStatusButtonPending, callback_data: 'pending' }]]
            }
        });

        await bot.deleteMessage(chatId, msg.message_id);

        handleTokenQueue(bot, mintUrl, { chatId, msg, qrCodePath, statusMessage, username, retryCount: 0 }, cashuApiUrl, claimedDisposeTiming, timeoutMinutes, checkIntervalSeconds, mintQueues);

    } catch (error) {
        console.error('Error processing message:', error);
        await bot.sendMessage(chatId, messages.errorMessage);
    }
}

module.exports = { handleMessage, checkTokenStatus, generateQRCode, deleteQRCode };
