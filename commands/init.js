import fs from 'fs';
import { HDB_ENV_FILE, HDB_ENV_FILE_CONTENTS } from '../utils/constants.js';
import logger from '../utils/logger.js';

export const command = 'init';
export const describe = 'Initialize the .env.hdb file with default values';

export const handler = () => {
  try {
    if (fs.existsSync(HDB_ENV_FILE)) {
      logger.warn('.env.hdb file already exists. Initialization skipped.');
      return;
    }

    fs.writeFileSync(HDB_ENV_FILE, HDB_ENV_FILE_CONTENTS);
    logger.info(
      '.env.hdb file has been initialized with default values. Please edit the file before continuing.'
    );
  } catch (error) {
    logger.error('Error occurred during initialization:', error.message);
    throw error;
  }
};
