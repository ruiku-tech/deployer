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

  // add your user config here
  const userConfig = {
    // myAppName: 'egg',
  };

  config.multipart = {
    mode: "file",
    fileSize: "50mb", // 设置最大文件大小
  };

  return {
    ...config,
    ...userConfig,
  };
};
