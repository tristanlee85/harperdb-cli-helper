const logger = require('./logger.js');

module.exports = async function runAPIOperation(command, commandArgs) {
  const { HARPERDB_TARGET, CLI_TARGET_USERNAME, CLI_TARGET_PASSWORD } =
    process.env;

  const requestBody = {
    operation: command,
    ...commandArgs,
  };

  logger.info('Running API operation:', command, requestBody);

  const response = await fetch(HARPERDB_TARGET, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(
        `${CLI_TARGET_USERNAME}:${CLI_TARGET_PASSWORD}`
      ).toString('base64')}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error(error);
    throw new Error(error);
  }

  const data = await response.json();
  return data;
};
