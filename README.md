# hdb_helper

A helper script for managing HarperDB operations.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Commands](#commands)
- [License](#license)

## Installation

1. Clone the repository or download the source code.
2. Navigate to the project directory.
3. Install the dependencies using npm:

   ```bash
   npm install
   ```

## Configuration

Before using the script, you need to configure the environment variables. The script uses a `.env.hdb` file to load necessary configurations.

1. Create a `.env.hdb` file in the root directory if it doesn't exist. The script will automatically create one with default values if it's missing.
2. Edit the `.env.hdb` file to include your HarperDB instance details:

   ```plaintext
   HARPERDB_TARGET="https://<instance>.harperdbcloud.com:9925"
   CLI_TARGET_USERNAME="HDB_ADMIN"
   CLI_TARGET_PASSWORD="<password>"
   ```

## Usage

To use the script, you can run it directly from the command line. The script provides several commands to interact with HarperDB.

### Running the Script

You can run the script using the following command:

```bash
npm start <command> [options]
```

Alternatively, you can use the binary directly:

```bash
./index.js <command> [options]
```

## Commands

- **deploy**: Deploy a component to HarperDB.
- **restart**: Restart the HarperDB instance.
- **run**: Run a specific operation.
- **dev**: Run the script in development mode.
- **reset**: Reset components.
- **drop**: Drop components.
- **logs**: Retrieve logs from HarperDB.

### Options

- `-o=<file>`: Write the operation output to a specified file.

### Examples

- Deploy a component:

  ```bash
  npm start deploy
  ```

- Retrieve logs with a filter:

  ```bash
  npm start logs --filter="/error/"
  ```

## License

This project is licensed under the ISC License.

```

This `README.md` provides a basic overview of how to set up and use your `hdb_helper` module. You can expand it with more detailed instructions or examples as needed.
```
