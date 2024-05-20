const { CashuMint, CashuWallet, getDecodedToken } = require('@cashu/cashu-ts');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const messages = require('../messages');

require('dotenv').config();

const qrCodeDir = './qrcodes';
if (!fs.existsSync(qrCodeDir)) {
    fs.mkdirSync(qrCodeDir);
}

const debugMode = process.env.DEBUG_MODE === 'true';
const timeoutMinutes = parseInt(process.env.TIMEOUT_MINUTES) || 5;

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

async function handleMessage(bot, msg, cashuApiUrl, claimedDisposeTiming) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    try {
        // Check if the token has been spent before processing
        const status = await checkTokenStatus(text);
        if (status === 'spent') {
            if (debugMode) console.log(`[INFO] Token already spent: ${text}`);
            return; // Do not process further if the token is already spent
        }

        // Decode the token to check if it's valid
        const decodedToken = getDecodedToken(text);

        // Generate QR code
        const qrCodePath = await generateQRCode(text);

        // Send the QR code message
        const qrMessage = await bot.sendPhoto(chatId, qrCodePath, {}, {
            filename: 'cashu-token.png',
            contentType: 'image/png'
        });

        // Send the status message
        const statusMessage = await bot.sendMessage(chatId, messages.pendingMessage(username, cashuApiUrl), {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [[{ text: messages.tokenStatusButtonPending, callback_data: 'pending' }]]
            }
        });

        let tokenSpent = false;

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
                }
            } catch (error) {
                if (error.message.includes('Rate limit exceeded')) {
                    console.error('Rate limit exceeded. Stopping updates for this message.');
                    clearInterval(intervalId);
                } else if (error.code !== 'ETELEGRAM' || !error.response || error.response.description !== 'Bad Request: message is not modified') {
                    console.error('Error updating message status:', error);
                }
            }
        };

        // Set interval to check the token status every 4 seconds
        const intervalId = setInterval(updateMessageStatus, 4000);

        // Delete the original token message if it's a valid token
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
            // Send error message if token is invalid
            await bot.sendMessage(chatId, messages.errorMessage);
        }
    }
}

module.exports = { handleMessage, checkTokenStatus, generateQRCode, deleteQRCode };
