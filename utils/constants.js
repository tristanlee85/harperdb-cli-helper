const HDB_ENV_FILE = '.env.harperdb';
const HDB_ENV_FILE_CONTENTS = `HARPERDB_TARGET="https://<instance>.harperdbcloud.com:9925"
CLI_TARGET_USERNAME="HDB_ADMIN"
CLI_TARGET_PASSWORD="<password>"
`;
const HDB_EXEC = 'harperdb';
const HDB_EXEC_COMMANDS = ['deploy_component', 'restart', 'run', 'dev'];
const BYPASS_PROMPT = ['init', 'run', 'dev'];
const AUTO_RESTART_COMMANDS = ['deploy_component', 'drop', 'reset'];
const RETAIN_COMPONENTS = ['prometheus_exporter', 'status-check'];

module.exports = {
  HDB_ENV_FILE,
  HDB_ENV_FILE_CONTENTS,
  HDB_EXEC,
  HDB_EXEC_COMMANDS,
  BYPASS_PROMPT,
  AUTO_RESTART_COMMANDS,
  RETAIN_COMPONENTS,
};
