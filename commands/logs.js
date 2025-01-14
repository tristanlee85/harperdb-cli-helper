const runAPIOperation = require('../utils/runAPIOperation.js');
const logger = require('../utils/logger.js');

exports.command = 'logs';
exports.describe =
  'Retrieve logs from HarperDB with filtering and lookback duration';

exports.builder = {
  filter: {
    alias: 'f',
    describe: 'Filter logs by a specific keyword or regex',
    type: 'string',
  },
  lookback: {
    alias: 't',
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
    describe: 'Tail logs',
    type: 'boolean',
    default: false,
  },
};

exports.handler = async (argv) => {
  const { filter, lookback, level, tail } = argv;
  const logMap = new Map();
  let isFirstFetch = true;

  const fetchLogs = async () => {
    try {
      const from = new Date(
        Date.now() - parseInt(lookback, 10) * 60 * 1000
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
      } else {
        regexFilter = new RegExp(filter, 'gi');
      }

      const boldColorStart = '\x1b[1;31m'; // Bold red
      const colorReset = '\x1b[0m';

      const filteredLogs = logs
        .filter((log) => {
          const crypto = require('crypto');
          const logKey = crypto
            .createHash('sha256')
            .update(`${log.timestamp}${log.message}`)
            .digest('hex');

          if (logMap.has(logKey)) return false;
          logMap.set(logKey, log);
          return true;
        })
        .map((log) => {
          if (!regexFilter) return log;

          let message = log.message;

          if (regexFilter.test(message)) {
            message = message.replaceAll(
              regexFilter,
              (match) => `${boldColorStart}${match}${colorReset}`
            );

            return { ...log, message };
          }
        })
        .filter(Boolean);

      logger.info(
        filter ? `Logs matching ${filter}:` : 'All logs:',
        filteredLogs.length,
        '\n'
      );

      filteredLogs.forEach((log) => {
        console.group(log.timestamp);
        Object.entries(log).forEach(([key, value]) => {
          console.log(`${key}: ${value}`);
        });
        console.log('\n');
        console.groupEnd();
      });
    } catch (error) {
      logger.toggleLogging(true);
      logger.error('Error occurred while retrieving logs:', error.message);
      if (!tail) {
        throw error;
      }
    } finally {
      if (isFirstFetch) {
        logger.toggleLogging(false);
        isFirstFetch = false;
      }

      if (tail) {
        logger.toggleLogging(false);
        setTimeout(fetchLogs, 1000);
      }
    }
  };

  await fetchLogs();
};
