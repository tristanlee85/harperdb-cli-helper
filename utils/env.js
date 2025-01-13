import fs from 'fs';
import dotenv from 'dotenv';

const HDB_ENV_FILE = '.env.hdb';

export function loadEnvironment() {
  if (!fs.existsSync(HDB_ENV_FILE)) {
    throw new Error('.env.hdb file is missing. Run "hdb init" to create it.');
  }

  dotenv.config({ path: HDB_ENV_FILE, override: true });

  const { HARPERDB_TARGET, CLI_TARGET_USERNAME, CLI_TARGET_PASSWORD } =
    process.env;

  if (!HARPERDB_TARGET || !CLI_TARGET_USERNAME || !CLI_TARGET_PASSWORD) {
    throw new Error('Required environment variables are missing in .env.hdb.');
  }

  return { HARPERDB_TARGET, CLI_TARGET_USERNAME, CLI_TARGET_PASSWORD };
}
