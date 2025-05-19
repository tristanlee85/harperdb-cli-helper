const { confirm: confirmPrompt } = require('@inquirer/prompts');
const { default: ora } = require('ora');
const chalk = require('chalk');
const readline = require('readline');

module.exports = async function confirm(query) {
  const response = await confirmPrompt({
    message: query.trim(),
    initial: true,
  });

  return response;
};

module.exports.autoConfirm = async function autoConfirm(options = {}) {
  const defaultOptions = {
    query: 'Are you sure you want to continue?',
    seconds: 5,
    enterKeyMsg: `${chalk.green('Enter')} to continue`,
    escKeyMsg: `${chalk.red('ESC')} to cancel`,
    separator: '\n',
  };
  const { query, seconds, enterKeyMsg, escKeyMsg, separator } = {
    ...defaultOptions,
    ...options,
  };
  const usageText = (seconds) =>
    `${escKeyMsg}, ${enterKeyMsg} (or wait ${seconds}s)`;
  const spinner = ora({
    text: `${query.trim()}${separator}${usageText(seconds)}`,
    color: 'yellow',
  }).start();

  let remaining = seconds;
  let isAborted = false;
  let isContinued = false;

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  const keypressHandler = (str, key) => {
    if (['escape', 'return'].includes(key.name)) {
      process.stdin.setRawMode(false);
      process.removeListener('keypress', keypressHandler);

      if (key.name === 'escape') {
        isAborted = true;
        spinner.fail('Cancelled by user');
      } else if (key.name === 'return') {
        isContinued = true;
        spinner.succeed('Continuing...');
      }
    }
  };
  process.stdin.on('keypress', keypressHandler);

  const interval = setInterval(() => {
    if (isAborted || isContinued) {
      clearInterval(interval);
      return;
    }
    remaining--;
    spinner.text = `${query.trim()}${separator}${usageText(remaining)}`;
  }, 1000);

  try {
    const doContinue = await Promise.race([
      new Promise((resolve) => {
        const checkState = setInterval(() => {
          if (isAborted) {
            clearInterval(interval);
            clearInterval(checkState);
            resolve(false);
          } else if (isContinued) {
            clearInterval(interval);
            clearInterval(checkState);
            resolve(true);
          }
        }, 10);
      }),
      new Promise((resolve) => {
        setTimeout(() => {
          if (!isAborted && !isContinued) {
            process.stdin.setRawMode(false);
            process.removeListener('keypress', keypressHandler);
            spinner.succeed('Continuing...');
            resolve(true);
          }
        }, seconds * 1000);
      }),
    ]);

    return doContinue;
  } catch (error) {
    if (error.message === 'aborted') {
      spinner.fail('Cancelled by user');
      return false;
    }
    throw error;
  }
};
