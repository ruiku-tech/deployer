module.exports = () => {
  return {
    mongoose: {
      client: {
        url: 'mongodb://127.0.0.1:33017/server_database',
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 50000, // 增加服务器选择超时
          connectTimeoutMS: 100000, // 增加连接超时
        },
      },
    },
  };
};
