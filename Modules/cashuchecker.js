const { CashuMint, CashuWallet, getDecodedToken } = require('@cashu/cashu-ts');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const messages = require('../messages');
const axios = require('axios');
const Jimp = require('jimp');
const { savePendingTokens, loadPendingTokens, saveData, loadData } = require('./dataCache');

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

async function generateQRCode(token) {
    const qrCodeImagePath = path.join(qrCodeDir, `${Date.now()}.png`);
    const cashuIconPath = path.join(__dirname, '../cashu.png');

    await QRCode.toFile(qrCodeImagePath, token, {
        errorCorrectionLevel: 'H',
        width: 300
    });

    const qrCodeImage = await Jimp.read(qrCodeImagePath);
    const cashuIcon = await Jimp.read(cashuIconPath);

    cashuIcon.resize(80, 80);
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

function deleteQRCode(filePath) {
    fs.unlink(filePath, (err) => {
        if (err) console.error(`Error deleting file ${filePath}:`, err);
    });
}

async function fetchAndCacheMintData() {
    try {
        const response = await axios.get('https://cashumints.space/wp-json/cashumints/all-cashu-mints/');
        const mints = response.data;
        saveData('mints.json', mints);
        return mints;
    } catch (error) {
        console.error('Error fetching mint data:', error);
        return null;
    }
}

async function getMintData(mintUrl) {
    let mints = loadData('mints.json');
    if (!mints) {
        mints = await fetchAndCacheMintData();
    }
    return mints.find(mint => mint.mint_url === mintUrl);
}

async function handleMessage(bot, msg, cashuApiUrl, claimedDisposeTiming) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    try {
        const status = await checkTokenStatus(text);
        if (status === 'spent') {
            if (debugMode) console.log(`[INFO] Token already spent: ${text}`);
            return;
        }

        const decodedToken = getDecodedToken(text);

        const mintData = await getMintData(decodedToken.token[0].mint);
        const mintName = mintData ? mintData.mint_name : 'Unknown Mint';
        const mintLink = mintData ? `https://cashumints.space/?p=${mintData.cct_single_post_id}` : '#';

        const qrCodePath = await generateQRCode(text);
        const claimLink = `${cashuApiUrl}?token=${encodeURIComponent(text)}`;

        const qrMessage = await bot.sendPhoto(chatId, qrCodePath, {}, {
            filename: 'cashu-token.png',
            contentType: 'image/png'
        });

        const statusMessage = await bot.sendMessage(chatId, messages.pendingMessage(username, text, claimLink), {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [[{ text: 'Rate Mint', url: mintLink }]]
            }
        });

        let tokenSpent = false;

        const pendingTokens = loadPendingTokens();
        pendingTokens.push({
            encoded: text,
            username: username,
            messageId: statusMessage.message_id,
            chatId: chatId
        });
        savePendingTokens(pendingTokens);

        const updateMessageStatus = async () => {
            if (tokenSpent) return;
            try {
                const currentStatus = await checkTokenStatus(text);
                if (currentStatus === 'spent') {
                    tokenSpent = true;

                    await bot.deleteMessage(chatId, qrMessage.message_id);

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

                    const updatedPendingTokens = loadPendingTokens().filter(token => token.encoded !== text);
                    savePendingTokens(updatedPendingTokens);
                }
            } catch (error) {
                if (error.message.includes('Rate limit exceeded')) {
                    console.error('Rate limit exceeded. Pausing updates for this message.');
                    clearInterval(intervalId);
                    setTimeout(() => {
                        console.log('Resuming updates after timeout.');
                        intervalId = setInterval(updateMessageStatus, checkIntervalSeconds * 1000);
                    }, timeoutMinutes * 60000);
                } else if (error.code !== 'ETELEGRAM' || !error.response || error.response.description !== 'Bad Request: message is not modified') {
                    console.error('Error updating message status:', error);
                }
            }
        };

        let intervalId = setInterval(updateMessageStatus, checkIntervalSeconds * 1000);

        await bot.deleteMessage(chatId, msg.message_id);

    } catch (error) {
        if (error.message.includes('Timeout pinging that mint')) {
            console.error('Timeout occurred while pinging the mint:', error);
            setTimeout(() => {
                console.log('Resuming processing after timeout.');
                handleMessage(bot, msg, cashuApiUrl, claimedDisposeTiming);
            }, timeoutMinutes * 60000);
        } else {
            console.error('Error processing message:', error);
            await bot.sendMessage(chatId, messages.errorMessage);
        }
    }
}

module.exports = { handleMessage, checkTokenStatus, generateQRCode, deleteQRCode };
