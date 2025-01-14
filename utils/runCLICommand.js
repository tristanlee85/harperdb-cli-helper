const { spawn } = require('child_process');
const logger = require('./logger.js');
const { HDB_EXEC } = require('./constants.js');

module.exports = async function runCLICommand(command, commandArgs) {
  const env = { ...process.env };
  const args = [
    command,
    ...(commandArgs ? commandArgs : []),
    `target=${process.env.HARPERDB_TARGET}`,
  ];

  logger.info(`Running command: ${HDB_EXEC} ${args.join(' ')}`);
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const process = spawn(HDB_EXEC, args, {
      env,
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      logger.info(data.toString());
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      logger.error(data.toString());
      stderr += data.toString();
    });

    process.on('close', (code) => {
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      logger.info(`Command completed in ${duration} seconds`);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Process exited with code ${code}\n${stderr}`));
      }
    });

    process.on('error', (error) => {
      reject(new Error(`Failed to start process: ${error.message}`));
    });
  });
};
