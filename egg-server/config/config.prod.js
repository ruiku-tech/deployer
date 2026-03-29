module.exports = () => {
  return {
    // MongoDB 配置保留用于迁移（迁移完成后可删除）
    mongoMigrate: {
      url: 'mongodb://127.0.0.1:33017/server_database',
      options: {
        serverSelectionTimeoutMS: 50000,
        connectTimeoutMS: 100000,
      },
    },
  };
};
