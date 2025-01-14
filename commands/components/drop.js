const runAPIOperation = require('../../utils/runAPIOperation.js');
const { checkbox } = require('@inquirer/prompts');
const prompt = require('../../utils/prompt.js');
const logger = require('../../utils/logger.js');
const { RETAIN_COMPONENTS } = require('../../utils/constants.js');

exports.command = 'drop';
exports.describe = 'Interactive selection of components to drop';

exports.handler = async () => {
  try {
    const components = await runAPIOperation('get_components');
    const componentsToDelete = components.entries
      .filter((entry) => !RETAIN_COMPONENTS.includes(entry.name))
      .map((entry) => entry.name);

    if (componentsToDelete.length === 0) {
      logger.info('No components available for deletion.');
      return;
    }

    const selectedComponents = await checkbox({
      message: 'Select components to drop:',
      choices: componentsToDelete,
    });

    if (selectedComponents.length === 0) {
      logger.info('No components selected. Exiting...');
      return;
    }

    const confirm = await prompt(
      `Are you sure you want to delete [${selectedComponents.join(', ')}]?`
    );

    if (!confirm) {
      logger.info('Exiting...');
      return;
    }

    for (const component of selectedComponents) {
      const result = await runAPIOperation('drop_component', {
        project: component,
      });
      logger.info(result);
    }
  } catch (error) {
    logger.error('Error occurred during drop operation:', error.message);
    throw error;
  }
};
