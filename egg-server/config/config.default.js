/* eslint valid-jsdoc: "off" */
const path = require("path");
/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = (appInfo) => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = (exports = {});

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + "_1715829868121_5703";

  // add your middleware config here
  config.middleware = [];

  // CSRF
  config.security = {
    csrf: {
      enable: false,
    },
  };

  config.cors = {
    origin: "*", // 允许所有来源请求，如果只允许特定来源，可以替换为具体的 URL，例如 'http://192.168.31.79:8080'
    allowMethods: "GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS",
    allowHeaders: "*", // 确保包含 'env'
    credentials: true, // 如果需要支持跨域 cookie
  };
  // add your user config here
  const userConfig = {
    // myAppName: 'egg',
  };
  config.static = {
    prefix: "/", // 访问静态资源的路径前缀
    dir: path.join(appInfo.baseDir, "app/public/dist"), // 静态文件存放的目录
    dynamic: true, // 是否支持动态加载
    preload: false, // 是否预加载静态资源
    maxAge: 31536000, // 浏览器缓存时间，单位为毫秒，默认为一年
    buffer: true, // 是否启用文件缓存
  };

  config.multipart = {
    mode: "stream",
    fileSize: "500mb", // 设置最大文件大小
    whitelist: () => true,
  };
  config.websocket = {
    path: "/ws",
  };
  config.mongoose = {
    client: {
      // url: "mongodb://127.0.0.1:33017/server_database",
      // url: 'mongodb://root:DevOps20220601@8.219.118.16:27017/data',
      // url: 'mongodb://43.132.219.112:33017/server_database',
      url: "mongodb://localhost:27017/server_database",
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 50000, // 增加服务器选择超时
        connectTimeoutMS: 100000, // 增加连接超时
      },
    },
  };
  return {
    ...config,
    ...userConfig,
  };
};
