'use strict';

// PM2 flattens each app's configuration into process.env. Passing those fields
// to another PM2 command can override that app's ecosystem configuration.
const configFields = [
  'script', 'name', 'name_prefix', 'filter_env', 'namespace', 'install_url',
  'cwd', 'args', 'exec_interpreter', 'node_args', 'out_file', 'error_file',
  'log_file', 'disable_logs', 'log_type', 'log_date_format', 'time', 'env',
  '^env_\\S*$', 'max_memory_restart', 'pid_file', 'restart_delay',
  'exp_backoff_restart_delay', 'source_map_support', 'disable_source_map_support',
  'wait_ready', 'instances', 'kill_timeout', 'shutdown_with_message',
  'listen_timeout', 'cron_restart', 'merge_logs', 'vizion', 'autostart',
  'autorestart', 'stop_exit_codes', 'watch_delay', 'watch', 'ignore_watch',
  'watch_options', 'min_uptime', 'max_restarts', 'execute_command', 'exec_mode',
  'force', 'append_env_to_name', 'post_update', 'trace', 'disable_trace', 'v8',
  'event_loop_inspector', 'deep_monitoring', 'increment_var', 'instance_var',
  'pmx', 'automation', 'treekill', 'port', 'username', 'uid', 'gid',
  'windowsHide', 'kill_retry_time', 'write', 'io',
];
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
  for (const key of [ ...configFields, ...runtimeFields ]) delete env[key];
  // Preserve PM2_HOME so all commands use the same daemon.
  return env;
};
