#!/usr/bin/env node
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const runCLICommand = require('./utils/runCLICommand.js');
const runAPIOperation = require('./utils/runAPIOperation.js');
const {
  initialize,
  isInitialized,
  loadEnvironment,
  migrateEnvToConfig,
} = require('./utils/configManager.js');
const logger = require('./utils/logger.js');
const prompt = require('./utils/prompt.js');
const {
  HDB_EXEC_COMMANDS,
  AUTO_RESTART_COMMANDS,
  BYPASS_PROMPT,
} = require('./utils/constants.js');
const chalk = require('chalk');

(async () => {
  await yargs(hideBin(process.argv))
    .scriptName('hdb')
    .usage(
      '$0 <command> [options...]',
      'Runs command as-is using `harperdb <command> [options...]`.',
      (yargs) => {
        yargs
          .parserConfiguration({
            'unknown-options-as-args': true,
          })
          .strict(false);
      },
      async (argv) => {
        const command = argv.command;
        const commandArgs = argv.options;
        const options = { ...argv };

        await executeCommand(command, commandArgs, options);
      }
    )
    .commandDir('./commands')
    .option('restart', {
      type: 'boolean',
      default: false,
      describe: `Restart the HarperDB instance after command succeeds.\nDefaults to 'true' for commands: [${AUTO_RESTART_COMMANDS.join(
        ', '
      )}]`,
    })
    .option('env', {
      describe: 'Environment to use',
      type: 'string',
    })
    .option('instance', {
      describe: 'Instance URL to use',
      type: 'string',
    })
    .strictCommands(false)
    .middleware(async (argv, yargs) => {
      if (argv.middlewareExecuted) {
        return;
      }
      argv.middlewareExecuted = true;

      const command = argv.command || argv._[0];
      const commandArgs = argv.options || argv._.slice(1);

      if (!['init', 'config'].includes(command)) {
        if (!isInitialized()) {
          const confirm = await prompt(
            `This project has not been initialized for 'hdb' commands. Initialize now?`
          );
          if (!confirm) {
            yargs.exit(0);
          }
          if (!(await initialize())) {
            yargs.exit(0);
          }
        }

        migrateEnvToConfig();

        const env = await loadEnvironment({
          env: argv.env,
          instance: argv.instance,
        });

        logger.clean.info('\n' + chalk.bold('Configuration'));
        logger.clean.info(
          chalk.dim('├─') +
            chalk.yellow(' Environment ') +
            chalk.dim('──────────────────────────────')
        );
        logger.clean.info(
          chalk.dim('│  ') +
            `${chalk.cyan(env.HDB_ENV)} → ${chalk.green(env.HARPERDB_TARGET)}`
        );
        logger.clean.info(
          chalk.dim('│  ') +
            `${chalk.gray('as')} ${chalk.blue(env.CLI_TARGET_USERNAME)}`
        );
        logger.clean.info(chalk.dim('│'));
        logger.clean.info(
          chalk.dim('└─') +
            chalk.yellow(' Command ') +
            chalk.dim('─────────────────────────────────')
        );
        logger.clean.info(
          chalk.dim('   ') + chalk.white(`${command} ${commandArgs.join(' ')}`)
        );
        logger.clean.info('');

        if (!BYPASS_PROMPT.includes(command)) {
          const confirm = await prompt.autoConfirm();
          if (!confirm) {
            yargs.exit(1);
          }
        }
      }
    }, true)
    .fail((msg, err, yargs) => {
      if (err) {
        logger.error(err.message);
      } else {
        logger.error(msg);
        yargs.showHelp();
      }
    })
    .help('help')
    .showHelpOnFail(false)
    .wrap(Math.min(yargs.terminalWidth(), 120))
    .parse();

  process.on('SIGINT', () => {
    process.exit(1);
  });
})();

async function executeCommand(command, commandArgs) {
  try {
    if (HDB_EXEC_COMMANDS.includes(command)) {
      await runCLICommand(command, commandArgs);
    } else {
      const result = await runAPIOperation(command, commandArgs);
      logger.info('Operation result:\n\n', result);
    }
  } catch (error) {
    logger.error('Error occurred during command execution:', error.message);
    throw error;
  }
}
