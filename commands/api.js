const runAPIOperation = require('../utils/runAPIOperation.js');
const logger = require('../utils/logger.js');

exports.command = 'api <operation>';
exports.describe = 'Run any HarperDB API operation with custom parameters';

exports.builder = (yargs) => {
  return yargs
    .positional('operation', {
      describe: 'The API operation to execute',
      type: 'string',
    })
    .options({
      json: {
        alias: 'j',
        describe: 'Parse argument as JSON string for complex parameters',
        type: 'string',
      },
      '*': {
        describe: 'Additional parameters to pass to the operation',
        type: 'string',
      },
    })
    .example([
      [
        '$0 api some_operation --param1=value1 --param2=value2',
        'Execute operation with simple parameters',
      ],
      ['', ''],
      [
        '$0 api some_operation --json=\'{"complex":"value", "array":["item1"]}\'',
        'Execute operation with complex JSON parameters',
      ],
      ['', ''],
      [
        '$0 api some_operation --json=\'{"nested":{"key":"value"}}\' --simple=value',
        'Execute operation with both JSON and simple parameters',
      ],
    ])
    .epilogue(
      'Additional Parameters:\n' +
        '  All parameters must use the --key=value format\n' +
        '  Parameters can be provided in two ways:\n' +
        '  1. Simple parameters: --param1=value1 --param2=value2\n' +
        '  2. Complex objects: --json=\'{"key":"value", "nested":{"key":"value"}}\'\n\n' +
        '  The --json parameter will be merged with any other parameters provided.'
    );
};

exports.handler = async (argv) => {
  try {
    const { operation, json } = argv;

    // We reference process.argv since `argv` will contain other arguments
    // unrelated to the command line arguments the user provided.
    const args = process.argv.slice(3);

    // Convert args to keys from --key=value format
    const providedKeys = args.map((arg) => {
      const match = arg.match(/^-*([^=]+)(?:=|$)/);
      const key = match ? match[1] : arg;

      // Remove any remaining dashes
      return key.replace(/^-+/, '');
    });

    // Create payload from explicitly provided args
    const payload = Object.fromEntries(
      Object.entries(argv).filter(([key]) => providedKeys.includes(key))
    );

    if (json) {
      try {
        const jsonPayload = JSON.parse(json);
        Object.assign(payload, jsonPayload);
      } catch (error) {
        throw new Error(`Failed to parse JSON parameter: ${error.message}`);
      }
    }

    logger.info(`Executing operation: ${operation}`);
    const result = await runAPIOperation(operation, payload);

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    logger.error('Error executing API operation:', error.message);
    throw error;
  }
};
