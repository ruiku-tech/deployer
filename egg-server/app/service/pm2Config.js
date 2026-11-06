module.exports = {
  apps: [
    {
      name: 'deployer',
      cwd: require('path').resolve(__dirname, '../..'),
      script: 'scripts/start.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      wait_ready: true,
      listen_timeout: 30000,
      kill_timeout: 10000,
      treekill: false,
      env: {
        NODE_ENV: 'production',
        EGG_SERVER_ENV: 'prod',
      },
    },
    {
      name: 'deployer-updater',
      cwd: require('path').resolve(__dirname, '../..'),
      script: 'scripts/upgrade.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: false,
      max_restarts: 0,
      env: {
        NODE_ENV: 'production',
        EGG_SERVER_ENV: 'prod',
        // Explicitly replace the previous task's value when PM2 reuses this app.
        UPGRADE_VERSION: process.env.UPGRADE_VERSION || '',
      },
    },
  ],
};
