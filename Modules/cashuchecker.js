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
        return spentProofs.length === proofs.length ? 'spent' : 'pending';
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
    fs.writeFileSync(tokenQueueFile, JSON.stringify(tokenQueue, null, 2));
}

// Function to load the token queue from a JSON file
function loadTokenQueue() {
    if (fs.existsSync(tokenQueueFile)) {
        return JSON.parse(fs.readFileSync(tokenQueueFile, 'utf-8'));
    }
    return {};
}

async function updateTokenStatus(bot, mintUrl, tokenData, cashuApiUrl, claimedDisposeTiming, checkIntervalSeconds) {
    const { chatId, msg, qrCodePath, statusMessage, username, retryCount } = tokenData;

    try {
        const currentStatus = await checkTokenStatus(msg.text);
        if (currentStatus === 'spent') {
            await bot.deleteMessage(chatId, statusMessage.message_id);
            await bot.deleteMessage(chatId, qrCodePath.message_id);

            const newMessage = messages.claimedMessage(username);
            await bot.sendMessage(chatId, newMessage, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
            });

            deleteQRCode(qrCodePath);
            return true; // Token is spent and processed
        }
    } catch (error) {
        if (error.status === 429) {
            console.error('Rate limit exceeded. Retrying after timeout.');
            if (retryCount < maxRetries) {
                const nextRetryCount = retryCount + 1;
                const nextRetryInterval = defaultRetryInterval * Math.pow(2, nextRetryCount);
                setTimeout(() => {
                    tokenData.retryCount = nextRetryCount;
                    updateTokenStatus(bot, mintUrl, tokenData, cashuApiUrl, claimedDisposeTiming, checkIntervalSeconds);
                }, nextRetryInterval);
            } else {
                console.error('Max retries reached for token:', msg.text);
            }
        } else {
            console.error('Error updating token status:', error);
        }
    }
    return false; // Token is not yet spent
}

async function processTokenQueue(bot, cashuApiUrl, claimedDisposeTiming, checkIntervalSeconds) {
    const tokenQueue = loadTokenQueue();

    for (const mintUrl of Object.keys(tokenQueue)) {
        const mintQueue = tokenQueue[mintUrl];
        for (const tokenData of mintQueue) {
            const isSpent = await updateTokenStatus(bot, mintUrl, tokenData, cashuApiUrl, claimedDisposeTiming, checkIntervalSeconds);
            if (isSpent) {
                mintQueue.shift();
                saveTokenQueue(tokenQueue);
            }
        }
    }
}

async function handleMessage(bot, msg, cashuApiUrl, claimedDisposeTiming, checkIntervalSeconds, mintQueues) {
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

        const tokenData = {
            chatId,
            msg,
            qrCodePath: qrMessage,
            statusMessage,
            username,
            retryCount: 0,
        };

        const tokenQueue = loadTokenQueue();
        if (!tokenQueue[mintUrl]) {
            tokenQueue[mintUrl] = [];
        }
        tokenQueue[mintUrl].push(tokenData);
        saveTokenQueue(tokenQueue);

        processTokenQueue(bot, cashuApiUrl, claimedDisposeTiming, checkIntervalSeconds);

    } catch (error) {
        console.error('Error processing message:', error);
        await bot.sendMessage(chatId, messages.errorMessage);
    }
}

module.exports = { handleMessage, checkTokenStatus, generateQRCode, deleteQRCode };
