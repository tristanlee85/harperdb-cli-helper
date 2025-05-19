const runAPIOperation = require('../utils/runAPIOperation.js');
const logger = require('../utils/logger.js');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

exports.command = 'logs';
exports.describe =
  'Retrieve logs from HarperDB with filtering and lookback duration';

exports.builder = {
  filter: {
    alias: 'f',
    describe: 'Filter logs by a specific keyword or regex',
    type: 'string',
  },
  duration: {
    alias: 'd',
    describe: 'Lookback duration in minutes',
    type: 'number',
    default: 15,
  },
  level: {
    alias: 'l',
    describe: 'Filter logs by a specific level',
    type: 'string',
  },
  tail: {
    alias: 't',
    describe: 'Tail logs',
    type: 'boolean',
    default: false,
  },
  out: {
    alias: 'o',
    describe: 'Output path for JSON file',
    type: 'string',
  },
};

exports.handler = async (argv) => {
  const { filter, duration, level, tail, out } = argv;
  const logMap = new Map();
  let isFirstFetch = true;
  const outPath = out ? path.join(process.cwd(), out) : null;
  let isShuttingDown = false;

  // Handle graceful shutdown
  const cleanup = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    process.exit(0);
  };

  // Register shutdown handlers
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  async function* logGenerator() {
    while (!isShuttingDown) {
      try {
        const from = new Date(
          Date.now() - parseInt(duration, 10) * 60 * 1000
        ).toISOString();
        const until = new Date().toISOString();

        logger.info(`Getting logs from ${from} to ${until}`);

        const logs = await runAPIOperation('read_log', {
          from,
          until,
          order: 'asc',
          level,
        });

        let regexFilter;
        if (filter && filter.startsWith('/') && filter.endsWith('/')) {
          regexFilter = new RegExp(filter.slice(1, -1), 'gi');
        } else if (filter) {
          regexFilter = new RegExp(filter, 'gi');
        }

        const boldColorStart = '\x1b[1;31m';
        const colorReset = '\x1b[0m';

        for (const log of logs) {
          if (isShuttingDown) return;

          const crypto = require('crypto');
          const logKey = crypto
            .createHash('sha256')
            .update(`${log.timestamp}${log.message}`)
            .digest('hex');

          if (logMap.has(logKey)) continue;
          logMap.set(logKey, log);

          let processedLog = { ...log };
          if (regexFilter) {
            let message = log.message;
            if (regexFilter.test(message)) {
              message = message.replaceAll(
                regexFilter,
                (match) => `${boldColorStart}${match}${colorReset}`
              );
              processedLog = { ...log, message };
            } else {
              continue;
            }
          }

          yield processedLog;
        }

        if (isFirstFetch) {
          logger.toggleLogging(false, true);
          isFirstFetch = false;
        }

        if (!tail) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        logger.toggleLogging(true, true);
        logger.error('Error occurred while retrieving logs:', error.message);
        if (!tail) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  try {
    let logsArray = [];
    if (outPath) {
      // Initialize main file if it doesn't exist
      try {
        const existingContent = await fs.readFile(outPath, 'utf8');
        logsArray = JSON.parse(existingContent);
      } catch (error) {
        await fs.writeFile(outPath, '[]');
      }
    }

    for await (const log of logGenerator()) {
      if (outPath) {
        logsArray.push(log);
        // Update the file with each new log
        await fs.writeFile(outPath, JSON.stringify(logsArray, null, 2));
      } else {
        console.group(log.timestamp);
        Object.entries(log).forEach(([key, value]) => {
          console.log(`${key}: ${value}`);
        });
        console.log('\n');
        console.groupEnd();
      }
    }
  } catch (error) {
    logger.toggleLogging(true, true);
    logger.error('Error occurred while retrieving logs:', error.message);
    throw error;
  } finally {
    await cleanup();
  }
};
