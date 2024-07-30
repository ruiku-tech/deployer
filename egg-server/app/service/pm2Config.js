module.exports = {
  apps: [
    {
      name: 'deployer',
      script: 'app.js', // 修改为你的入口文件
      instances: 1, // 运行实例的数量
      exec_mode: 'fork', // 运行模式，可以选择 fork 或 cluster
      watch: true, // 是否监听文件变化，用于自动重启
      env: {
        NODE_ENV: 'production',
        PORT: 80,
      },
    },
  ],
};
