/* eslint valid-jsdoc: "off" */

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

  //CSRF
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

  config.multipart = {
    mode: "file",
    fileSize: "50mb", // 设置最大文件大小
  };
  config.websocket = {
    path: "/ws",
  };
  return {
    ...config,
    ...userConfig,
  };
};
