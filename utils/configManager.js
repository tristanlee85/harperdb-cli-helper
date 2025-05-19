const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const chalk = require('chalk');
const deepmerge = require('deepmerge');
const logger = require('./logger.js');
const { input, confirm, select, password } = require('@inquirer/prompts');
const { autoConfirm } = require('./prompt.js');

// Stores settings such as default environment and instance
const CONFIG_FILE = '.hdbconfig.json';
const CONFIG_FILE_PATH = path.join(process.cwd(), CONFIG_FILE);
// Stores HarperDB instance credentials
const ENV_FILE = '.env.harperdb';
const ENV_FILE_PATH = path.join(process.cwd(), ENV_FILE);

const GITIGNORE = '.gitignore';
const GITIGNORE_PATH = path.join(process.cwd(), GITIGNORE);
const IGNORE_CONTENTS = [
  '# HarperDB Helper Configuration',
  CONFIG_FILE,
  ENV_FILE,
];

const INSTANCE_URL_MESSAGE =
  'Format: https://<instance_hostname>:9925\n' +
  'Or just enter the instance hostname (e.g. my-instance.harperfabric.com):';

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

/**
 * Determines if the current directory has been initialized via `hdb init` by
 * checking for the existence of the .env.harperdb file
 */
function isInitialized() {
  return fs.existsSync(ENV_FILE_PATH) && fs.existsSync(CONFIG_FILE_PATH);
}

/**
 * Reads the .env.harperdb file
 */
function readEnvFile() {
  return fs.readFileSync(ENV_FILE_PATH, 'utf8');
}

/**
 * Parses the .env.harperdb file into an object
 */
function parseEnvFile() {
  return dotenv.parse(readEnvFile());
}

/**
 * Writes the .env.harperdb file
 * @param {string} content - The content to write to the file
 */
function writeEnvFile(content) {
  fs.writeFileSync(ENV_FILE_PATH, content);
}

/**
 * Determines if the current directory has been initialized via `hdb init` by
 * checking for the existence of the .hdbconfig file
 */
function hasConfigFile() {
  return fs.existsSync(CONFIG_FILE_PATH);
}

/**
 * Reads the .hdbconfig file
 */
function readConfigFile() {
  return fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
}

/**
 * Parses the .hdbconfig.json file into an object
 * @param {Object} defaultConfig - The default configuration
 * @returns {Object} The parsed configuration
 */
function parseConfigFile(defaultConfig) {
  try {
    return JSON.parse(readConfigFile());
  } catch (error) {
    if (defaultConfig) {
      return defaultConfig;
    }
    throw new Error(`Error parsing ${CONFIG_FILE}: ${error.message}`);
  }
}

function updateConfigFile(updates, options = {}) {
  const config = parseConfigFile({});
  const mergedConfig = deepmerge(config, updates, options);
  fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(mergedConfig, null, 2));
}

/**
 * Updates the .env.harperdb file with the new/updated credentials
 * @param {Object} updates - The key/value pairs to update in the file
 */
function updateEnvFile(updates) {
  const content = readEnvFile();

  const lines = content.split('\n');
  const existingKeys = new Set();

  // We iterate over the lines instead of parsing/writing the from an object
  // to preserve the original formatting including comments and empty lines.
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
  writeEnvFile(lines.join('\n') + '\n');
}

/**
 * Formats an instance URL
 * @param {string} input - The instance URL to format
 * @returns {string} The formatted instance URL
 */
function formatInstanceUrl(input) {
  try {
    // If it's already a full URL, extract the hostname
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const { hostname } = new URL(input);
      return `https://${hostname}:9925`;
    }
    // Otherwise, construct the URL from the instance name
    return `https://${input}:9925`;
  } catch (error) {
    throw new Error(`Invalid instance URL: ${error.message}`);
  }
}

/**
 * Adds a new environment to the .env.harperdb file
 */
async function addEnvironment() {
  const config = parseConfigFile({});

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
        'Instance URL (empty to finish, or comma-separated for multiple)\n' +
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

  const newEnv = {
    environments: {
      [name]: {
        username,
        password: pwd,
        instances: Array.from(instances),
      },
    },
  };

  updateConfigFile(newEnv);
  logger.clean.info(`Added environment: ${name}`);

  const setDefault = await confirm({
    message: 'Would you like to set this as the default environment?',
    default: config.defaultEnv === null, // Only set as default if no default is set
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

    updateConfigFile({
      defaultEnv: name,
      defaultInstance: instanceUrl,
    });
    logger.clean.info(`Set default environment to ${name} (${instanceUrl})`);
  }
}

async function initialize() {
  try {
    const envExamplePath = path.join(__dirname, '..', `${ENV_FILE}.example`);
    const configExamplePath = path.join(
      __dirname,
      '..',
      `${CONFIG_FILE}.example`
    );

    if (!fs.existsSync(ENV_FILE_PATH)) {
      fs.copyFileSync(envExamplePath, ENV_FILE_PATH);
      logger.clean.info(`Created ${ENV_FILE} from example`);
    }

    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      fs.copyFileSync(configExamplePath, CONFIG_FILE_PATH);
      logger.clean.info(`Created ${CONFIG_FILE} from example`);
    }

    if (!fs.existsSync(GITIGNORE_PATH)) {
      fs.writeFileSync(GITIGNORE_PATH, IGNORE_CONTENTS.join('\n'));
      logger.clean.info(`Created ${GITIGNORE}`);
    } else {
      const contents = fs.readFileSync(GITIGNORE_PATH, 'utf8');

      // Skip the first item as it is a comment
      const missingContents = IGNORE_CONTENTS.slice(1).filter(
        (content) => !contents.includes(content)
      );
      if (missingContents.length > 0) {
        fs.writeFileSync(
          GITIGNORE_PATH,
          [...contents, ...missingContents].join('\n')
        );
        logger.clean.info(`Updated ${GITIGNORE}`);
      }
    }

    migrateEnvToConfig();

    // Check if any environments are configured
    const envs = getEnvironments();
    if (envs.size === 0) {
      const addEnv = await confirm({
        message: 'No environments configured. Would you like to add one now?',
        default: true,
      });

      if (addEnv) {
        await addEnvironment();
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

/**
 * Gets the environments from the .hdbconfig.json file
 * @returns {Map} The environments
 */
function getEnvironments() {
  const config = parseConfigFile({});
  return new Map(Object.entries(config.environments));
}

/**
 * Adds a new instance to an environment
 */
async function addInstance() {
  const envs = getEnvironments();

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

  updateConfigFile(updates);
  logger.clean.info(`Added instance to ${env}`);
}

/**
 * Loads the environment
 * @param {Object} options - The options
 * @returns {Object} The environment
 */
async function loadEnvironment(options = {}) {
  if (!isInitialized()) {
    throw new Error('Missing configuration file(s). Run `hdb init` first.');
  }

  const envs = getEnvironments();
  const config = parseConfigFile({});

  let selectedEnv, instance;

  // Environment variables are set, which overrides any CLI flags or .env.harperdb settings
  const hasEnvvars = process.env.HDB_ENV && process.env.HDB_INSTANCE;

  // CLI flags are set, which overrides any .env.harperdb settings
  const hasFlags = options.env && options.instance;

  // Default env and instance are set in the .env.harperdb file
  const hasDefaults = config.defaultEnv && config.defaultInstance;

  if (hasEnvvars) {
    selectedEnv = envs.get(process.env.HDB_ENV);
    instance = process.env.HDB_INSTANCE;
  } else if (hasFlags) {
    selectedEnv = envs.get(options.env);
    instance = options.instance;
  } else if (hasDefaults) {
    const envName = config.defaultEnv;
    selectedEnv = envs.get(envName);
    instance = config.defaultInstance;

    if (!selectedEnv || !instance) {
      logger.clean.warn(
        `Invalid default environment or instance: ${envName} - ${instance}`
      );
      selectedEnv = null;
      instance = null;
    } else {
      // Use defaults but allow quick switch
      const shouldContinue = await autoConfirm({
        query: `Using default environment: ${chalk.cyan(envName)} (${chalk.cyan(instance)})`,
        escKeyMsg: `Press ${chalk.red('ESC')} to change`,
      });
      // Clear the environment and instance so they can be selected again
      if (!shouldContinue) {
        selectedEnv = null;
        instance = null;
      }
    }
  }

  // If no valid environment or instance is set, go through selection
  if (!selectedEnv || !instance) {
    const envName = await select({
      message: 'Select environment:',
      choices: Array.from(envs.keys()).map((key) => ({
        value: key,
        label: key,
      })),
      theme: PROMPT_THEME,
    });
    selectedEnv = envs.get(envName);

    instance = await select({
      message: 'Select instance:',
      choices: selectedEnv.instances.map((url) => ({
        value: url,
        label: url,
      })),
      theme: PROMPT_THEME,
    });
  }

  // Set environment variables
  process.env.CLI_TARGET_USERNAME = selectedEnv.username;
  process.env.CLI_TARGET_PASSWORD = selectedEnv.password;
  process.env.HARPERDB_TARGET = instance;
  process.env.HDB_ENV = Array.from(envs.keys()).find(
    (key) => envs.get(key) === selectedEnv
  );

  return {
    CLI_TARGET_USERNAME: process.env.CLI_TARGET_USERNAME,
    CLI_TARGET_PASSWORD: process.env.CLI_TARGET_PASSWORD,
    HARPERDB_TARGET: process.env.HARPERDB_TARGET,
    HDB_ENV: process.env.HDB_ENV,
  };
}

/**
 * Migrates the environment configuration from .env.harperdb to .hdbconfig.json
 */
function migrateEnvToConfig() {
  const config = parseConfigFile({});
  const env = parseEnvFile();
  const envExamplePath = path.join(__dirname, '..', `${ENV_FILE}.example`);

  if (!Object.keys(env).length) {
    return;
  }

  // Process each environment from .env.harperdb
  let updated = 0;
  Object.entries(env).forEach(([key, value]) => {
    if (key.startsWith('ENV_') && key.endsWith('_INSTANCES')) {
      const envName = key.slice(4, -10); // Remove 'ENV_' prefix and '_INSTANCES' suffix
      const instances = value.split(',').map((url) => url.trim());

      // Check if environment already exists in config
      const targetKey = config.environments[envName]
        ? `${envName}_COPY`
        : envName;

      // Add environment to config
      config.environments[targetKey] = {
        username: env[`ENV_${envName}_USERNAME`] || 'HDB_ADMIN',
        password: env[`ENV_${envName}_PASSWORD`] || '',
        instances,
      };
      updated++;
    }
  });

  if (updated) {
    logger.clean.info(
      `Migrated ${updated} environments from .env.harperdb to .hdbconfig.json`
    );
    // Write updated config
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));

    // Copy example env file over existing
    fs.copyFileSync(envExamplePath, ENV_FILE_PATH);
  }
}

module.exports = {
  ENV_FILE,
  isInitialized,
  initialize,
  getEnvironments,
  loadEnvironment,
  updateEnvFile,
  updateConfigFile,
  addEnvironment,
  addInstance,
  migrateEnvToConfig,
};
