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

// Default logger uses normal format (includes level)
const logger = createLogger({
  level: 'info',
  transports: [
    new transports.Console({
      format: normalFormat,
    }),
  ],
});

let loggingEnabled = true;

logger.toggleLogging = function (enable) {
  loggingEnabled = enable;
  this.transports.forEach((transport) => {
    transport.silent = !loggingEnabled;
  });
};

// Clean format (no level, no timestamps)
logger.clean = {
  info: (message) => {
    const cleanLogger = createLogger({
      level: 'info',
      transports: [new transports.Console({ format: cleanFormat })],
    });
    cleanLogger.info(message);
  },
  warn: (message) => {
    const cleanLogger = createLogger({
      level: 'warn',
      transports: [new transports.Console({ format: cleanFormat })],
    });
    cleanLogger.warn(message);
  },
  error: (message) => {
    const cleanLogger = createLogger({
      level: 'error',
      transports: [new transports.Console({ format: cleanFormat })],
    });
    cleanLogger.error(message);
  },
};

// Verbose format (includes timestamps)
logger.verbose = {
  info: (message) => {
    const verboseLogger = createLogger({
      level: 'info',
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            timestampFormat
          ),
        }),
      ],
    });
    verboseLogger.info(message);
  },
  warn: (message) => {
    const verboseLogger = createLogger({
      level: 'warn',
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            timestampFormat
          ),
        }),
      ],
    });
    verboseLogger.warn(message);
  },
  error: (message) => {
    const verboseLogger = createLogger({
      level: 'error',
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            timestampFormat
          ),
        }),
      ],
    });
    verboseLogger.error(message);
  },
};

module.exports = logger;
