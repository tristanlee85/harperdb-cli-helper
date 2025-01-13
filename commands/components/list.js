import { runAPIOperation } from '../../utils/runAPIOperation.js';
import logger from '../../utils/logger.js';

export const command = 'list';
export const describe = 'List all components';

export const handler = async () => {
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
