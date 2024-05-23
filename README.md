# CashuMints Telegram Bot

The CashuMints Telegram Bot is a promotional bot for CashuMints.space, allowing users to interact with Cashu wallets and mints via Telegram. The bot can handle various commands to display top mints, top wallets, decode and encode tokens, and check the status of Cashu tokens.

## Features

- Display top mints and top wallets.
- Decode and encode Cashu tokens.
- Check the status of Cashu tokens.
- Generate QR codes for Cashu tokens.
- Automatically clean up messages in group chats.

## Commands
User Commands
/start: Start the bot and get a welcome message.
/help: Get help on how to use the bot.
/cashumints top: Show the top mints.
/cashuwallets top: Show the top wallets.
/cashudecode [token]: Decode a Cashu token.
/cashuencode [token data]: Encode token data.
/request mint: Request minting tokens.
/check invoice [hash]: Check the status of an invoice.

If a Cashu token is detected in the message, the bot will generate a QR code, send it, and update the status of the token.


## Error Handling
The bot logs detailed error messages and statuses to the console for easier debugging.
Errors related to polling, webhook, and unexpected issues are handled and logged appropriately.

## Contributing
We welcome contributions! Please fork the repository and create a pull request with your changes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Contact
For any inquiries or further assistance, please open an issue in the repository, and our team will respond promptly.

## Acknowledgements
Special thanks to all contributors who have helped improve this project.
