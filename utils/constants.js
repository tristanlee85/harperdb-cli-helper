export const HDB_ENV_FILE = '.env.hdb';
export const HDB_ENV_FILE_CONTENTS = `HARPERDB_TARGET="https://<instance>.harperdbcloud.com:9925"
CLI_TARGET_USERNAME="HDB_ADMIN"
CLI_TARGET_PASSWORD="<password>"
`;
export const HDB_EXEC = 'harperdb';
export const HDB_EXEC_COMMANDS = ['deploy_component', 'restart', 'run', 'dev'];
export const BYPASS_PROMPT = ['init', 'run', 'dev'];
export const AUTO_RESTART_COMMANDS = ['deploy_component', 'drop', 'reset'];
export const RETAIN_COMPONENTS = ['prometheus_exporter', 'status-check'];
