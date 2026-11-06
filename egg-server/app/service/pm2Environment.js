'use strict';

// PM2 flattens each app's configuration into process.env. Passing those fields
// to another PM2 command can override that app's ecosystem configuration.
const configFields = Object.keys(require('pm2/lib/API/schema.json'));
const runtimeFields = [
  'env', 'pm_id', 'pm_exec_path', 'pm_cwd', 'pm_out_log_path',
  'pm_err_log_path', 'pm_pid_path', 'status', 'pm_uptime', 'created_at',
  'restart_time', 'unstable_restarts', 'prev_restart_delay', 'exit_code',
  'axm_actions', 'axm_options', 'axm_dynamic', 'axm_monitor', 'versioning',
  'vizion_running', 'vizion_runing', 'node_version', 'unique_id',
  'NODE_APP_INSTANCE', 'NODE_UNIQUE_ID', 'PM2_USAGE', 'PM2_JSON_PROCESSING',
];

module.exports = function pm2Environment(source = process.env) {
  const env = { ...source };
  for (const key of [...configFields, ...runtimeFields]) delete env[key];
  // Preserve PM2_HOME so all commands use the same daemon.
  return env;
};
