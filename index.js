#!/usr/bin/env node
// -*- mode: javascript -*-

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

const HDB_ENV_FILE = '.env.hdb';
const HDB_ENV_FILE_CONTENTS = `HARPERDB_TARGET="https://<instance>.harperdbcloud.com:9925"
CLI_TARGET_USERNAME="HDB_ADMIN"
CLI_TARGET_PASSWORD="<password>"
`;
const HDB_EXEC = 'harperdb';
const HDB_EXEC_COMMANDS = ['deploy_component', 'restart', 'run', 'dev'];
const BYPASS_PROMPT = ['run', 'dev'];

const commandAliases = {
  deploy: 'deploy_component',
  components: 'get_components',
};

const customOperations = {
  reset: resetComponents,
  drop: dropComponents,
  logs: getLogs,
};

const autoRestartCommands = ['deploy_component', 'drop', 'reset'];

const retainComponents = ['prometheus_exporter', 'status-check'];

// Resolve globally-installed module
function resolveGlobal(moduleName) {
  const globalRoot = execSync('npm root -g').toString().trim();
  const modulePath = path.join(globalRoot, moduleName);
  if (!fs.existsSync(modulePath)) {
    throw new Error(`Module '${moduleName}' is not installed globally.`);
  }
  return require(modulePath);
}

// Load the globally installed dotenv
const dotenv = require('dotenv');

// Load environment variables
//dotenv.config({ path: '.env' });
dotenv.config({ path: HDB_ENV_FILE, override: true });

// Helper to prompt for confirmation using inquirer
const prompt = async (query) => {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: query.trim(),
      default: true,
    },
  ]);
  return confirm;
};

// Verify required files
// if (!fs.existsSync('.env')) {
//   console.warn(
//     '.env file is missing. Some environment variables may not be loaded.'
//   );
// }

if (!fs.existsSync(HDB_ENV_FILE)) {
  fs.writeFileSync(HDB_ENV_FILE, HDB_ENV_FILE_CONTENTS);
  console.info(
    '.env.hdb file is missing and has been initialized with default values. Please edit the file and run the command again.'
  );

  process.exit(1);
}

// Verify required environment variables
const { HARPERDB_TARGET, CLI_TARGET_USERNAME, CLI_TARGET_PASSWORD } =
  process.env;

if (!HARPERDB_TARGET || !CLI_TARGET_USERNAME || !CLI_TARGET_PASSWORD) {
  console.error(
    'Required environment variables are missing in .env.hdb. Exiting...'
  );
  process.exit(1);
}

// Determine the command and arguments
const command = commandAliases[process.argv[2]] || process.argv[2];
const commandArgs = process.argv.slice(3);

// Optionally write the operation output to a file
let outputFile;
commandArgs.forEach((arg, index) => {
  if (arg.startsWith('-o=')) {
    outputFile = arg.split('=')[1];
    commandArgs.splice(index, 1);
  }
});

(async () => {
  try {
    // Print configuration and prompt for confirmation
    console.log(`
Configuration:
  HARPERDB_TARGET: ${HARPERDB_TARGET}
  CLI_TARGET_USERNAME: ${CLI_TARGET_USERNAME}
  CLI_TARGET_PASSWORD: ${CLI_TARGET_PASSWORD}
  COMMAND: ${command} ${commandArgs.join(' ')}
    `);

    if (!BYPASS_PROMPT.includes(command)) {
      const confirm = await prompt('Are you sure you want to continue?');
      if (!confirm) {
        console.log('Exiting...');
        process.exit(1);
      }
    }

    // CLI command
    if (HDB_EXEC_COMMANDS.includes(command)) {
      await runCLICommand(command, commandArgs);
    } else {
      if (typeof customOperations[command] === 'function') {
        console.log('Running custom operation:', command);
        const result = await customOperations[command](
          commandArgsToObject(commandArgs)
        );
        if (result) {
          console.log('Operation result:\n\n', result);
        }
      } else {
        const result = await runAPIOperation(command, commandArgs);
        console.log('Operation result:\n\n', result);
      }
    }

    if (autoRestartCommands.includes(command)) {
      console.log('Restarting HarperDB...');
      await runCLICommand('restart');
    }

    if (outputFile) {
      fs.writeFileSync(outputFile, result);
    }

    process.on('SIGINT', () => {
      console.log('Terminating process...');
      process.exit(1);
    });
  } catch (error) {
    console.error('Error occurred:', error.message);
    throw error;
  }
})();

function commandArgsToObject(commandArgs) {
  let args = {};

  if (Array.isArray(commandArgs)) {
    args = commandArgs.reduce((acc, arg) => {
      const [key, value] = arg.split('=');
      acc[key] = value;
      return acc;
    }, args);
  } else if (
    Object.prototype.toString.call(commandArgs) === '[object Object]'
  ) {
    args = commandArgs;
  }

  return args;
}

async function runCLICommand(command, commandArgs) {
  const args = [
    command,
    ...(commandArgs ? commandArgs : []),
    `target=${HARPERDB_TARGET}`,
  ];

  console.log(`Running command: ${HDB_EXEC} ${args.join(' ')}`);
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const process = spawn(HDB_EXEC, args);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      console.log(data.toString());
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      console.error(data.toString());
      stderr += data.toString();
    });

    process.on('close', (code) => {
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`Command completed in ${duration} seconds`);
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
}

async function runAPIOperation(command, commandArgs) {
  const requestBody = {
    operation: command,
    ...commandArgsToObject(commandArgs),
  };

  console.log('Running API operation:', command, requestBody);

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
    console.error(error);
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

async function resetComponents() {
  const components = await runAPIOperation('get_components');
  const componentsToDelete = components.entries
    .filter((entry) => !retainComponents.includes(entry.name))
    .map((entry) => entry.name);

  if (componentsToDelete.length === 0) {
    console.log('No components available for deletion.');
    return;
  }

  const { selectedComponents } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedComponents',
      message: 'Select components to drop:',
      choices: componentsToDelete,
    },
  ]);

  if (selectedComponents.length === 0) {
    console.log('No components selected. Exiting...');
    return;
  }

  const confirm = await prompt(
    `Are you sure you want to delete [${selectedComponents.join(', ')}]?`
  );

  if (!confirm) {
    console.log('Exiting...');
    return;
  }

  for (const component of selectedComponents) {
    const result = await runAPIOperation('drop_component', {
      project: component,
    });
    console.log(result);
  }
}

async function dropComponents() {
  const components = await runAPIOperation('get_components');
  const componentsToDelete = components.entries
    .filter((entry) => !retainComponents.includes(entry.name))
    .map((entry) => entry.name);

  if (componentsToDelete.length === 0) {
    console.log('No components available for deletion.');
    return;
  }

  const { selectedComponents } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedComponents',
      message: 'Select components to drop:',
      choices: componentsToDelete,
    },
  ]);

  if (selectedComponents.length === 0) {
    console.log('No components selected. Exiting...');
    return;
  }

  const confirm = await prompt(
    `Are you sure you want to delete [${selectedComponents.join(', ')}]?`
  );

  if (!confirm) {
    console.log('Exiting...');
    return;
  }

  for (const component of selectedComponents) {
    const result = await runAPIOperation('drop_component', {
      project: component,
    });
    console.log(result);
  }
}

async function getLogs({ filter, lookback = 15 }) {
  const from = new Date(
    Date.now() - parseInt(lookback, 10) * 60 * 1000
  ).toISOString();
  const until = new Date().toISOString();
  console.log(`Getting logs from ${from} to ${until}`);

  const logs = await runAPIOperation('read_log', {
    from,
    until,
    order: 'asc',
  });

  // Parse filter as a regex if it starts with / and ends with /
  if (filter && filter.startsWith('/') && filter.endsWith('/')) {
    filter = new RegExp(filter.slice(1, -1), 'gi');
  } else {
    filter = new RegExp(filter, 'gi');
  }

  // ANSI escape codes for bold and color
  const boldColorStart = '\x1b[1;31m'; // Bold red
  const colorReset = '\x1b[0m';

  const filteredLogs = logs
    .map((log) => {
      if (!filter) return log;

      let message = log.message;

      if (filter.test(message)) {
        message = message.replaceAll(
          filter,
          (match) => `${boldColorStart}${match}${colorReset}`
        );

        return { ...log, message };
      }
    })
    .filter(Boolean);

  console.log(
    filter ? `Logs matching ${filter}:` : 'All logs:',
    filteredLogs.length,
    '\n'
  );
  filteredLogs.forEach((log) => {
    console.group(log.timestamp);
    Object.entries(log).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
    console.log('\n');
    console.groupEnd();
  });
}
