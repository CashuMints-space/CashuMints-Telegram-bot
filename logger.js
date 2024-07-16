const winston = require('winston');
require('dotenv').config();

const debugMode = process.env.DEBUG_MODE === 'true';

const transports = [
  new winston.transports.Console()
];

if (debugMode) {
  transports.push(new winston.transports.File({ filename: 'bot.log' }));
}

const logger = winston.createLogger({
  level: debugMode ? 'info' : 'warn',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports
});

module.exports = logger;
