const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.colorize(),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message, context }) => {
      return `${timestamp} [${level}]${
        context ? ` [${context}]` : ''
      }: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    //new transports.File({ filename: 'app.log' }),
  ],
});

let loggingEnabled = true;

logger.toggleLogging = function (enable) {
  loggingEnabled = enable;
  this.transports.forEach((transport) => {
    transport.silent = !loggingEnabled;
  });
};

module.exports = logger;
