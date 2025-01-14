const fs = require('fs');
const dotenv = require('dotenv');

const logger = require('./logger.js');
const { HDB_ENV_FILE, HDB_ENV_FILE_CONTENTS } = require('./constants.js');

exports.loadEnvironment = function () {
  dotenv.config({ path: HDB_ENV_FILE, override: true });

  const { HARPERDB_TARGET, CLI_TARGET_USERNAME, CLI_TARGET_PASSWORD } =
    process.env;

  if (!HARPERDB_TARGET || !CLI_TARGET_USERNAME || !CLI_TARGET_PASSWORD) {
    throw new Error('Required environment variables are missing in .env.hdb.');
  }

  return { HARPERDB_TARGET, CLI_TARGET_USERNAME, CLI_TARGET_PASSWORD };
};

exports.isInitialized = function () {
  return fs.existsSync(HDB_ENV_FILE);
};

exports.initialize = function () {
  try {
    if (exports.isInitialized()) {
      logger.warn('.env.hdb file already exists. Initialization skipped.');
      return true;
    }

    fs.writeFileSync(HDB_ENV_FILE, HDB_ENV_FILE_CONTENTS);
    logger.info(
      `Initialized project with default '${HDB_ENV_FILE}' file. Update the file and run the command again.`
    );

    // Check if the project is a Git repository
    if (fs.existsSync('.git')) {
      const gitignorePath = '.gitignore';
      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        if (!gitignoreContent.includes(HDB_ENV_FILE)) {
          fs.appendFileSync(gitignorePath, `\n${HDB_ENV_FILE}\n`);
          logger.info(`Added '${HDB_ENV_FILE}' to .gitignore.`);
        }
      } else {
        // Create a .gitignore file if it doesn't exist
        fs.writeFileSync(gitignorePath, `${HDB_ENV_FILE}\n`);
        logger.info(`Created .gitignore and added '${HDB_ENV_FILE}'.`);
      }
    }

    return false;
  } catch (error) {
    logger.error('Error occurred during initialization:', error.message);
    throw error;
  }
};
