#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runCLICommand } from './utils/runCLICommand.js';
import { runAPIOperation } from './utils/runAPIOperation.js';
import { loadEnvironment } from './utils/env.js';
import logger from './utils/logger.js';
import { prompt } from './utils/prompt.js';
import {
  HDB_EXEC_COMMANDS,
  AUTO_RESTART_COMMANDS,
  BYPASS_PROMPT,
} from './utils/constants.js';

// Import command modules
import * as initCommand from './commands/init.js';
import * as resetCommand from './commands/components/reset.js';
import * as listCommand from './commands/components/list.js';
import * as dropCommand from './commands/components/drop.js';
import * as logsCommand from './commands/logs.js';
// Add more imports as needed

(async () => {
  try {
    yargs(hideBin(process.argv))
      .command(initCommand)
      .command(resetCommand)
      .command(listCommand)
      .command(dropCommand)
      .command(logsCommand)
      // Add more commands as needed
      .middleware(async (argv, context) => {
        const command = argv._[0];
        const commandArgs = argv._.slice(1);

        console.log('argv', argv);
        console.log('context', context);

        if (command !== 'init') {
          const { HARPERDB_TARGET, CLI_TARGET_USERNAME, CLI_TARGET_PASSWORD } =
            loadEnvironment();
          logger.info(`
Configuration:
  HARPERDB_TARGET: ${HARPERDB_TARGET}
  CLI_TARGET_USERNAME: ${CLI_TARGET_USERNAME}
  CLI_TARGET_PASSWORD: ${CLI_TARGET_PASSWORD}
  COMMAND: ${command} ${commandArgs.join(' ')}
          `);

          if (!BYPASS_PROMPT.includes(command)) {
            const confirm = await prompt('Are you sure you want to continue?');
            if (!confirm) {
              logger.info('Exiting...');
              process.exit(1);
            }
          }
        }
      })
      .demandCommand(1, 'You need to specify a command')
      .help().argv;

    process.on('SIGINT', () => {
      logger.info('Terminating process...');
      process.exit(1);
    });
  } catch (error) {
    logger.error('Error occurred:', error.message);
    process.exit(1);
  }
})();

export async function executeCommand(command, commandArgs) {
  try {
    if (HDB_EXEC_COMMANDS.includes(command)) {
      await runCLICommand(command, commandArgs);
    } else {
      const result = await runAPIOperation(command, commandArgs);
      logger.info('Operation result:\n\n', result);
    }

    if (AUTO_RESTART_COMMANDS.includes(command)) {
      logger.info('Restarting HarperDB...');
      await runCLICommand('restart');
    }
  } catch (error) {
    logger.error('Error occurred during command execution:', error.message);
    throw error;
  }
}
