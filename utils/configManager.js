const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const chalk = require('chalk');
const logger = require('./logger.js');
const { input, confirm, select, password } = require('@inquirer/prompts');

const ENV_FILE = '.env.harperdb';
const INSTANCE_URL_MESSAGE =
  'Format: https://<instance>.harperdbcloud.com:9925\n' +
  'Or just enter the instance name:';

const PROMPT_THEME = {
  prefix: {
    idle: chalk.cyan('?'),
    done: chalk.green('✓'),
  },
  style: {
    message: (text, status) => {
      switch (status) {
        case 'done':
          return chalk.dim(text);
        case 'loading':
          return chalk.cyan(text);
        default:
          return chalk.bold(text);
      }
    },
    answer: (text) => chalk.green(text),
    error: (text) => chalk.red(text),
    defaultAnswer: (text) => chalk.dim(text),
  },
  validationFailureMode: 'clear',
};

function updateEnvFile(envPath, updates) {
  // Read existing content
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  // Parse existing content into lines
  const lines = content.split('\n');
  const existingKeys = new Set();

  // Update existing lines and track what we've seen
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() && !line.startsWith('#')) {
      const match = line.match(/^([^=]+)=/);
      if (match) {
        const key = match[1].trim();
        existingKeys.add(key);
        if (key in updates) {
          lines[i] = `${key}="${updates[key]}"`;
          delete updates[key];
        }
      }
    }
  }

  // Add any new keys that weren't in the file
  Object.entries(updates).forEach(([key, value]) => {
    if (!existingKeys.has(key)) {
      lines.push(`${key}="${value}"`);
    }
  });

  // Write back to file, preserving empty lines and comments
  fs.writeFileSync(envPath, lines.join('\n') + '\n');
}

function isInitialized() {
  return fs.existsSync(path.join(process.cwd(), ENV_FILE));
}

function formatInstanceUrl(input) {
  try {
    // If it's already a full URL, extract the hostname
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const url = new URL(input);
      // Remove any potential .harperdbcloud.com suffix to get clean instance name
      const instance = url.hostname.replace('.harperdbcloud.com', '');
      return `https://${instance}.harperdbcloud.com:9925`;
    }
    // Otherwise, construct the URL from the instance name
    return `https://${input}.harperdbcloud.com:9925`;
  } catch (error) {
    throw new Error(`Invalid instance URL: ${error.message}`);
  }
}

async function addEnvironment(envPath) {
  const name = (
    await input({
      message: 'Environment name:',
      validate: (input) => {
        if (!input.match(/^[A-Za-z0-9_]+$/)) {
          return 'Name can only contain letters, numbers, and underscores';
        }
        return true;
      },
      transformer: (input) => input.toUpperCase(),
      theme: PROMPT_THEME,
    })
  ).toUpperCase();

  const username = await input({
    message: 'Username:',
    default: 'HDB_ADMIN',
    theme: PROMPT_THEME,
  });

  const pwd = await password({
    message: 'Password:',
    theme: PROMPT_THEME,
  });

  const instances = new Set();
  let instanceInput;

  const finishedMessage = 'Leave blank if done';

  do {
    instanceInput = await input({
      message:
        'Instance URL (empty to finish, comma-separated for multiple)\n' +
        INSTANCE_URL_MESSAGE,
      validate: (input) => {
        if (!input) return true;
        try {
          input.split(',').forEach((url) => formatInstanceUrl(url.trim()));
          return true;
        } catch (error) {
          return error.message;
        }
      },
      default: instanceInput ? finishedMessage : undefined,
      theme: PROMPT_THEME,
    });

    if (instanceInput === finishedMessage) {
      break;
    }

    if (instanceInput) {
      instanceInput
        .split(',')
        .map((url) => url.trim())
        .forEach((url) => instances.add(formatInstanceUrl(url)));
    }
  } while (instanceInput);

  if (instances.size === 0) {
    throw new Error('At least one instance URL is required');
  }

  const updates = {
    [`ENV_${name}_USERNAME`]: username,
    [`ENV_${name}_PASSWORD`]: pwd,
    [`ENV_${name}_INSTANCES`]: Array.from(instances).join(','),
  };

  updateEnvFile(envPath, updates);
  logger.clean.info(`Added environment: ${name}`);

  const setDefault = await confirm({
    message: 'Would you like to set this as the default environment?',
    default: true,
    theme: PROMPT_THEME,
  });

  if (setDefault) {
    const instanceUrl =
      instances.size === 1
        ? Array.from(instances)[0]
        : await select({
            message: 'Select default instance:',
            choices: Array.from(instances).map((url) => ({
              value: url,
              label: url,
            })),
            theme: PROMPT_THEME,
          });

    const defaultUpdates = {
      DEFAULT_ENV: name,
      DEFAULT_INSTANCE: instanceUrl,
    };

    updateEnvFile(envPath, defaultUpdates);
    logger.clean.info(`Set default environment to ${name} (${instanceUrl})`);
  }
}

async function initialize() {
  try {
    const envPath = path.join(process.cwd(), ENV_FILE);
    const examplePath = path.join(__dirname, '..', `${ENV_FILE}.example`);
    let fileExists = fs.existsSync(envPath);

    if (!fileExists) {
      if (fs.existsSync(examplePath)) {
        fs.copyFileSync(examplePath, envPath);
        logger.clean.info(`Created ${ENV_FILE} from example`);
      } else {
        logger.warn(`Example file not found at ${examplePath}`);
        fs.writeFileSync(envPath, '# HarperDB Configuration\n');
        logger.clean.info(`Created empty ${ENV_FILE}`);
      }
      fileExists = true;
    } else {
      logger.warn(`${ENV_FILE} already exists`);
    }

    // Check if any environments are configured
    const { envs } = getEnvironments();
    if (envs.size === 0) {
      const addEnv = await confirm({
        message: 'No environments configured. Would you like to add one now?',
        default: true,
      });

      if (addEnv) {
        await addEnvironment(envPath);
      } else {
        logger.clean.info(
          "Run 'hdb config add-env' when you're ready to add an environment"
        );
      }
    }

    return true;
  } catch (error) {
    logger.error('Error initializing configuration:', error);
    return false;
  }
}

function getEnvironments() {
  const envPath = path.join(process.cwd(), ENV_FILE);
  const envs = new Map();
  const config = fs.existsSync(envPath)
    ? dotenv.parse(fs.readFileSync(envPath))
    : {};

  // Check for legacy format
  if (config.CLI_TARGET_USERNAME) {
    envs.set('default', {
      username: config.CLI_TARGET_USERNAME,
      password: config.CLI_TARGET_PASSWORD,
      instances: [config.HARPERDB_TARGET],
    });
  }

  // Parse ENV_ format
  Object.entries(config).forEach(([key, value]) => {
    if (key.startsWith('ENV_')) {
      const [, envName, type] = key.split('_');
      if (!envs.has(envName)) {
        envs.set(envName, {});
      }

      const env = envs.get(envName);
      if (type === 'USERNAME') env.username = value;
      if (type === 'PASSWORD') env.password = value;
      if (type === 'INSTANCES') env.instances = value.split(',');
    }
  });

  return { envs, config };
}

async function addInstance(envPath) {
  const { envs } = getEnvironments();

  if (!envs.size) {
    throw new Error('No environments configured. Add one first.');
  }

  const env = await select({
    message: 'Select environment:',
    choices: Array.from(envs.keys()).map((key) => ({
      value: key,
      label: key,
    })),
    theme: PROMPT_THEME,
  });

  const url = formatInstanceUrl(
    await input({
      message: 'Instance URL\n' + INSTANCE_URL_MESSAGE,
      validate: (input) => {
        try {
          formatInstanceUrl(input.trim());
          return true;
        } catch (error) {
          return error.message;
        }
      },
      theme: PROMPT_THEME,
    })
  );

  const envData = envs.get(env);
  const instances = new Set(envData.instances);
  instances.add(url);

  const updates = {};
  if (env === 'default') {
    updates.HARPERDB_TARGET = url;
  } else {
    updates[`ENV_${env}_INSTANCES`] = Array.from(instances).join(',');
  }

  updateEnvFile(envPath, updates);
  logger.clean.info(`Added instance to ${env}`);
}

async function loadEnvironment(options = {}) {
  const envPath = path.join(process.cwd(), ENV_FILE);

  if (!fs.existsSync(envPath)) {
    throw new Error('No .env.harperdb found. Run `hdb config init` first.');
  }

  const { envs, config } = getEnvironments();

  // Check for CLI flags or environment variables
  const targetEnv = options.env || process.env.HDB_ENV || config.DEFAULT_ENV;
  const targetInstance =
    options.instance || process.env.HDB_INSTANCE || config.DEFAULT_INSTANCE;

  // Check for legacy format
  if (config.CLI_TARGET_USERNAME) {
    process.env.CLI_TARGET_USERNAME = config.CLI_TARGET_USERNAME;
    process.env.CLI_TARGET_PASSWORD = config.CLI_TARGET_PASSWORD;
    process.env.HARPERDB_TARGET = config.HARPERDB_TARGET;
    return { parsed: process.env };
  }

  let selectedEnv, instance;
  const hasDefaults = config.DEFAULT_ENV && config.DEFAULT_INSTANCE;

  if (hasDefaults && !options.env && !options.instance) {
    // Use defaults but allow quick switch
    process.stdout.write(
      chalk.dim(
        `Using ${chalk.cyan(config.DEFAULT_ENV)} (press 'x' within 1s to change)...`
      )
    );

    const shouldSwitch = await new Promise((resolve) => {
      let timeoutId;
      const cleanup = () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeAllListeners('data');
        clearTimeout(timeoutId);
      };

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once('data', (data) => {
        cleanup();
        resolve(data.toString().toLowerCase() === 'x');
      });

      timeoutId = setTimeout(() => {
        cleanup();
        resolve(false);
      }, 1000);
    });

    process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear the prompt

    if (!shouldSwitch) {
      selectedEnv = envs.get(config.DEFAULT_ENV);
      instance = config.DEFAULT_INSTANCE;
    }
  }

  // If no defaults or switch requested, go through selection
  if (!selectedEnv) {
    if (targetEnv && envs.has(targetEnv)) {
      selectedEnv = envs.get(targetEnv);
    } else if (!targetEnv && envs.size === 1) {
      selectedEnv = envs.values().next().value;
    } else {
      throw new Error(`Environment "${targetEnv}" not found`);
    }

    if (!instance) {
      if (targetInstance && selectedEnv.instances.includes(targetInstance)) {
        instance = targetInstance;
      } else if (!targetInstance && selectedEnv.instances.length === 1) {
        instance = selectedEnv.instances[0];
      } else {
        throw new Error(
          `Instance "${targetInstance}" not found in environment`
        );
      }
    }
  }

  // Set environment variables
  process.env.CLI_TARGET_USERNAME = selectedEnv.username;
  process.env.CLI_TARGET_PASSWORD = selectedEnv.password;
  process.env.HARPERDB_TARGET = instance;
  process.env.HDB_ENV = Array.from(envs.keys()).find(
    (key) => envs.get(key) === selectedEnv
  );

  return { parsed: process.env };
}

module.exports = {
  ENV_FILE,
  isInitialized,
  initialize,
  getEnvironments,
  loadEnvironment,
  updateEnvFile,
  addEnvironment,
  addInstance,
};
