module.exports = {
  startMessage: `
Welcome to the CashuMints Telegram Bot! Here's how to get started:

1. **Using the Bot in Private Chat:**
   - Send me a Cashu token, and I’ll provide you with a QR code and the status of the token.

2. **Using the Bot in Group Chats:**
   - Add me to a group and give me admin permissions with only the 'Remove Messages' permission enabled.
   - I only need this permission to remove Cashu tokens after processing them to keep the chat clean and tidy.

Happy Satoshi hunting!
  `,
  helpMessage: `
Here’s how to use the CashuMints Telegram Bot:

1. **Send a Cashu token:** If you send me a Cashu token, I’ll generate a QR code and check its status.
2. **Commands:**
   - /topcashumints: Show top 3 mints.
   - /topcashuwallets: Show top 3 wallets.
   - /cashudecode [token]: Decode a Cashu token.

If you have any questions, feel free to ask!
  `,
  errorMessage: 'Error processing your request. Please try again later.',
  pendingMessage: (username, cashuApiUrl) => `
${username} shared a Cashu token 🥜

Click here to claim to Lightning: [Claim link](${cashuApiUrl})
  `,
  claimedMessage: (username) => `
${username} shared a Cashu token 🥜

Cashu token has been claimed ✅
  `,
  tokenMessage: (encoded) => `
Here is your encoded token:

\`${encoded}\`
  `,
  requestHashMessage: 'Please provide the hash to check the invoice.',
  tokenStatusButtonPending: 'Token Status: Pending',
};
