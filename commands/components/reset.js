import { runAPIOperation } from '../../utils/runAPIOperation.js';
import { prompt } from '../../utils/prompt.js';
import logger from '../../utils/logger.js';

const RETAIN_COMPONENTS = ['prometheus_exporter', 'status-check'];

export const command = 'reset';
export const describe =
  'Resets the HarperDB instance components to the default state by dropping all components';

export const handler = async () => {
  try {
    const components = await runAPIOperation('get_components');
    const componentsToDelete = components.entries
      .filter((entry) => !RETAIN_COMPONENTS.includes(entry.name))
      .map((entry) => entry.name);

    if (componentsToDelete.length === 0) {
      logger.info('No components available for deletion.');
      return;
    }

    const confirm = await prompt(
      `Are you sure you want to delete all components except [${RETAIN_COMPONENTS.join(
        ', '
      )}]?`
    );

    if (!confirm) {
      logger.info('Exiting...');
      return;
    }

    for (const component of componentsToDelete) {
      const result = await runAPIOperation('drop_component', {
        project: component,
      });
      logger.info(result);
    }
  } catch (error) {
    logger.error('Error occurred during reset operation:', error.message);
    throw error;
  }
};
