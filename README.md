# HarperDB CLI Helper

A helper script for managing HarperDB operations.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Commands](#commands)
- [License](#license)

## Installation

Install the script globally using npm:

```bash
npm install -g git+ssh://git@github.com:tristanlee85/harperdb-cli-helper.git#main
```

The `hdb` command will be available globally.

## Configuration

Before using the script, you need to configure the environment variables. The script uses a `.env.harperdb` file to load necessary configurations on a per-project basis.

1. Generate the default `.env.harperdb` file by running the following in the root of your project:

```bash
hdb init
```

2. Edit the `.env.harperdb` file to include your HarperDB instance details:

   ```plaintext
   HARPERDB_TARGET="https://<instance>.harperdbcloud.com:9925"
   CLI_TARGET_USERNAME="HDB_ADMIN"
   CLI_TARGET_PASSWORD="<password>"
   ```

## Usage

The script provides several commands to interact with HarperDB. Similar to running `harperdb`, `hdb` should be executed from the root of your project.

```bash
hdb <command> [options...]
```

All commands available to `harperdb` are available to `hdb`. For example, `hdb run .` is equivalent to `harperdb run .`.

## Commands

- **`hdb <command> [options...]`**: Runs the command as-is using `harperdb <command> [options...]`.
- **`hdb init`**: Initialize the current project with a `.env.harperdb` file.
- **`hdb components list`**: List all components in the HarperDB instance.

  Usage:

  ```bash
  hdb components list # List all components
  hdb components list [name] # List a specific component and its file structure
  ```

- **`hdb components drop`**: Selectively drop components from the HarperDB instance.

- **`hdb components reset`**: Resets the HarperDB instance components to its initial state by dropping all non-HarperDB components.
- **`hdb logs`**: Retrieve logs from HarperDB with filtering and lookback duration.

  Usage:

  ```bash
  hdb logs # Show logs from the last 15 minutes
  hdb logs filter="error" # Show logs with the word "error" in the message
  hdb logs filter=/some-regex/ lookback=45 # Show logs from the last 45 minutes matching the expression in the message
  hdb logs --tail # Tail the logs in real-time
  ```

## License

This project is licensed under the ISC License.
