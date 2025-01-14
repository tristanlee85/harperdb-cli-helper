const runAPIOperation = require('../../utils/runAPIOperation.js');
const logger = require('../../utils/logger.js');
const chalk = require('chalk');

exports.command = 'list [name]';
exports.describe = 'List all components, or a specific component';
exports.builder = {
  showFiles: {
    alias: 'f',
    describe: 'Show files in the component',
    type: 'boolean',
    default: false,
  },
};
exports.handler = async ({ name, showFiles }) => {
  try {
    const components = await runAPIOperation('get_components');
    if (components.entries.length === 0) {
      logger.info(chalk.yellow('No components found.'));
      return;
    }

    let output = `\n${chalk.underline('Available components:')}\n`;
    components.entries
      .filter((component) => (name ? component.name === name : true))
      .forEach((component) => {
        if (showFiles || name) {
          const logFiles = (
            entry,
            indent = '',
            isLast = true,
            isRoot = false
          ) => {
            if (isRoot) {
              output += `\n${chalk.bold(chalk.blue(`${entry.name}`))}\n`;
            }
            if (entry.entries) {
              if (!isRoot) {
                output += `${indent}${isLast ? '└── ' : '├── '}${chalk.blue(
                  chalk.bold(`${entry.name}`)
                )}\n`;
              }
              entry.entries.forEach((subEntry, index) =>
                logFiles(
                  subEntry,
                  `${indent}${isRoot ? '' : isLast ? '    ' : '│   '}`,
                  index === entry.entries.length - 1
                )
              );
            } else {
              output += `${indent}${isLast ? '└── ' : '├── '}${chalk.gray(
                `${entry.name} (${entry.size} bytes)`
              )}\n`;
            }
          };

          logFiles(component, '', true, true);
        } else {
          output += `\n- ${chalk.bold(chalk.blue(`${component.name}`))}`;
        }
      });
    logger.info(output);
  } catch (error) {
    logger.error(
      chalk.red('Error occurred while listing components:'),
      chalk.red(error.message)
    );
    throw error;
  }
};
