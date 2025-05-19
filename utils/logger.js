const { createLogger, format, transports } = require('winston');

const timestampFormat = format.printf(
  ({ timestamp, level, message, context }) => {
    return `${timestamp} [${level}]${context ? ` [${context}]` : ''}: ${message}`;
  }
);

const cleanFormat = format.combine(
  format.colorize(),
  format.printf(({ message }) => message)
);

const normalFormat = format.combine(
  format.colorize(),
  format.printf(({ level, message }) => `[${level}]: ${message}`)
);

const verboseFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  timestampFormat
);

const createSilentLogger = (format) => {
  const logger = createLogger({
    level: 'info',
    silent: false,
    transports: [new transports.Console({ format })],
  });

  logger.toggleLogging = function (enable, all = false) {
    if (all) {
      loggers.forEach((logger) => {
        logger.silent = !enable;
      });
    } else {
      this.silent = !enable;
    }
  };

  return logger;
};

const logger = createSilentLogger(normalFormat);
const cleanLogger = createSilentLogger(cleanFormat);
const verboseLogger = createSilentLogger(verboseFormat);

const loggers = [logger, cleanLogger, verboseLogger];

logger.clean = cleanLogger;
logger.verbose = verboseLogger;

module.exports = logger;
