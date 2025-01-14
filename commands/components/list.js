const runAPIOperation = require('../../utils/runAPIOperation.js');
const logger = require('../../utils/logger.js');

exports.command = 'list';
exports.describe = 'List all components';
exports.handler = async () => {
  try {
    const components = await runAPIOperation('get_components');
    if (components.entries.length === 0) {
      logger.info('No components found.');
      return;
    }

    logger.info('Available components:');
    components.entries.forEach((component) => {
      logger.info(`- ${component.name}`);
    });
  } catch (error) {
    logger.error('Error occurred while listing components:', error.message);
    throw error;
  }
};
