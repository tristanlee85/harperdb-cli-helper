const runAPIOperation = require('../utils/runAPIOperation.js');
const logger = require('../utils/logger.js');

exports.command = 'logs';
exports.describe =
  'Retrieve logs from HarperDB with filtering and lookback duration';

exports.builder = {
  filter: {
    describe: 'Filter logs by a specific keyword or regex',
    type: 'string',
  },
  lookback: {
    describe: 'Lookback duration in minutes',
    type: 'number',
    default: 15,
  },
};

exports.handler = async (argv) => {
  const { filter, lookback } = argv;
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
    logger.error('Error occurred while retrieving logs:', error.message);
    throw error;
  }
};
