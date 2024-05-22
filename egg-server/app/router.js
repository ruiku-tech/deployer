/**
 * @param {Egg.Application} app - egg application
 */
module.exports = (app) => {
  const deployMiddle = app.middleware.deployMiddle();
  const { router, controller } = app;
  router.get("/", controller.home.index);

  app.ws.route("/deploy", controller.ws.connect);
  // 获取变量
  router.get("/deploy/vars", deployMiddle, controller.deploy.getVars);
  // 获取配置
  router.post("/deploy/vars", deployMiddle, controller.deploy.updateVars);

  // 获取文件列表
  router.get("/deploy/files", deployMiddle, controller.deploy.getFiles);
  router.get(
    "/deploy/files-stat",
    deployMiddle,
    controller.deploy.getFilesStat
  );
  // 文件上传
  router.post("/deploy/file", deployMiddle, controller.deploy.uploadFile);
  // 获取服务器列表
  router.delete("/deploy/file", deployMiddle, controller.deploy.deleteFile);

  // {服务器名字:'host,password'}
  // 获取服务器列表
  router.get("/deploy/hosts", deployMiddle, controller.deploy.getHosts);
  // 获取服务器列表
  router.post("/deploy/hosts", deployMiddle, controller.deploy.postHosts);

  // 获取配置列表
  router.get("/deploy/configs", deployMiddle, controller.deploy.getConfigs);
  // 获取配置
  router.get("/deploy/config", deployMiddle, controller.deploy.getConfig);
  // 上传配置
  router.post("/deploy/config", deployMiddle, controller.deploy.postConfig);
  // 删除配置
  router.delete("/deploy/config", deployMiddle, controller.deploy.deleteConfig);

  // 获取脚本列表
  router.get("/deploy/scripts", deployMiddle, controller.deploy.getScripts);
  // 获取脚本
  router.get("/deploy/script", deployMiddle, controller.deploy.getScript);
  // 更新脚本
  router.post("/deploy/script", deployMiddle, controller.deploy.postScript);
  // 删除脚本
  router.delete("/deploy/script", deployMiddle, controller.deploy.deleteScript);

  // 获取编排列表
  router.get("/deploy/bats", deployMiddle, controller.deploy.getBats);
  // 获取编排
  router.get("/deploy/bat", deployMiddle, controller.deploy.getbat);
  // 新增编排
  router.post("/deploy/bat", deployMiddle, controller.deploy.postBat);
  // 删除编排
  router.delete("/deploy/bat", deployMiddle, controller.deploy.deleteBat);
  // 更新编排
  router.post("/deploy/bat-item", deployMiddle, controller.deploy.postBatItem);
  // 删除部署
  router.delete(
    "/deploy/bat-item",
    deployMiddle,
    controller.deploy.deleteBatItem
  );
  // 获取脚本列表
  router.get("/deploy/deploys", deployMiddle, controller.deploy.getDeploys);

  // 部署
  router.post("/deploy/deploy", deployMiddle, controller.deploy.postDeploy);
  router.post("/deploy/run", deployMiddle, controller.deploy.postRun);

  // 获取正在部署的
  router.get("/deploy/deployings", controller.deploy.getDeployings);

  // 获取部署
  router.delete(
    "/deploy/deploying",
    deployMiddle,
    controller.deploy.deleteDeploying
  );

  // 申请证书
  router.post(
    "/deploy/deploy-ssl",
    deployMiddle,
    controller.deploy.postDeploySsl
  );

  router.get("/deploy/api_auto", deployMiddle, controller.deploy.getApiAuto);

  // 注册
  router.post("/deploy/register", controller.deploy.postRegister);
  // 登陆
  router.post("/deploy/login", controller.deploy.postLogin);
  // 记录列表
  router.get(
    "/deploy/recordList",
    deployMiddle,
    controller.deploy.getRecordList
  );
  //删除记录数据
  router.post(
    "/deploy/recordDelete",
    deployMiddle,
    controller.deploy.postRecordDelete
  );
  // 获取环境列表
  router.get("/deploy/env/list", controller.env.getList);
  // 新建环境
  router.post("/deploy/env/one", controller.env.postOne);
  // 删除配置
  router.delete("/deploy/env/one", controller.env.deleteOne);
};
