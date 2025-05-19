const path = require('path');
const { select } = require('@inquirer/prompts');
const logger = require('../utils/logger.js');
const {
  ENV_FILE,
  getEnvironments,
  updateConfigFile,
  initialize,
  addEnvironment,
  addInstance,
} = require('../utils/configManager.js');
const chalk = require('chalk');

exports.command = 'config <action>';
exports.describe = 'Manage HarperDB configuration';

exports.builder = (yargs) => {
  return yargs
    .positional('action', {
      describe: 'Action to perform',
      choices: ['init', 'add-env', 'add-instance', 'select', 'list', 'use'],
      type: 'string',
    })
    .option('env', {
      describe: 'Environment name to use (non-interactive)',
      type: 'string',
    })
    .option('instance', {
      describe: 'Instance URL to use (non-interactive)',
      type: 'string',
    })
    .example([
      ['$0 config init', 'Create new .env.harperdb file'],
      ['', ''],
      ['$0 config add-env', 'Add new environment credentials'],
      ['', ''],
      ['$0 config add-instance', 'Add instance to an environment'],
      ['', ''],
      ['$0 config select', 'Interactively select environment and instance'],
      ['', ''],
      ['$0 config list', 'List all configured environments and instances'],
      ['$0 config use DEV', 'Set DEV as the default environment'],
      ['', ''],
      ['$0 config use DEV --instance=url', 'Set specific instance as default'],
      ['', ''],
      [
        '$0 --env=DEV --instance=url',
        'Use specific env/instance for this command',
      ],
    ]);
};

exports.handler = async (argv) => {
  const { action } = argv;
  const envPath = path.join(process.cwd(), ENV_FILE);

  switch (action) {
    case 'init': {
      await initialize();
      break;
    }

    case 'add-env': {
      await addEnvironment(envPath);
      break;
    }

    case 'add-instance': {
      await addInstance(envPath);
      break;
    }

    case 'list': {
      const envs = getEnvironments();

      if (envs.size === 0) {
        logger.info('No environments found');
        return;
      }

      for (const [name, data] of envs) {
        logger.clean.info(chalk.bold(name));
        logger.clean.info(chalk.dim(`Username: ${data.username}`));
        logger.clean.info(chalk.dim('Instances:'));
        data.instances.forEach((url) =>
          logger.clean.info(chalk.dim(`- ${url}`))
        );
        logger.clean.info('');
      }
      break;
    }

    case 'select': {
      logger.info(
        'Environment/instance selection will occur when running commands'
      );
      break;
    }

    case 'use': {
      const envs = getEnvironments();

      // Get environment name from args or prompt
      let envName;
      if (argv.env) {
        envName = argv.env.toUpperCase();
        if (!envs.has(envName)) {
          logger.error(`Environment "${envName}" not found`);
          return;
        }
      } else {
        envName = await select({
          message: 'Select environment to use as default:',
          choices: Array.from(envs.keys()).map((key) => ({
            value: key,
            label: key,
          })),
        });
      }

      const envData = envs.get(envName);

      // Get instance URL from args or prompt if multiple exist
      let instanceUrl = argv.instance;
      if (!instanceUrl && envData.instances.length > 1) {
        instanceUrl = await select({
          message: 'Select instance to use as default:',
          choices: envData.instances.map((url) => ({
            value: url,
            label: url,
          })),
        });
      } else if (!instanceUrl) {
        instanceUrl = envData.instances[0];
      }

      // Validate selected instance exists
      if (!envData.instances.includes(instanceUrl)) {
        logger.error(
          `Instance "${instanceUrl}" not found in environment "${envName}"`
        );
        return;
      }

      // Save defaults to config
      updateConfigFile({
        defaultEnv: envName,
        defaultInstance: instanceUrl,
      });
      logger.clean.info(
        `Set default environment to ${envName} (${instanceUrl})`
      );
      break;
    }
  }
};
