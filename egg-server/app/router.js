/**
 * @param {Egg.Application} app - egg application
 */
const mongoose = require("mongoose");
mongoose.set("debug", true);
module.exports = (app) => {
  const deployMiddle = app.middleware.deployMiddle();
  const auth = app.middleware.auth();
  const { router, controller } = app;
  // router.get("/", controller.home.index);

  app.ws.route("/deploy", controller.ws.connect);
  app.ws.route("/terminal/:env", controller.ws.terminal);
  // 获取变量
  router.get("/deploy/vars", auth, deployMiddle, controller.deploy.getVars);
  // 获取配置
  router.post("/deploy/vars", auth, deployMiddle, controller.deploy.updateVars);

  // 获取文件列表
  router.get("/deploy/files", auth, deployMiddle, controller.deploy.getFiles);
  router.get(
    "/deploy/files-stat",
    auth,
    deployMiddle,
    controller.deploy.getFilesStat
  );
  // 文件上传
  router.post("/deploy/file", auth, deployMiddle, controller.deploy.uploadFile);
  router.post("/deploy/clone", auth, deployMiddle, controller.deploy.fileClone);

  // 获取服务器列表
  router.delete(
    "/deploy/file",
    auth,
    deployMiddle,
    controller.deploy.deleteFile
  );

  // 远程文件管理
  router.get(
    "/deploy/remote-files",
    auth,
    deployMiddle,
    controller.deploy.getRemoteFiles
  );
  router.get(
    "/deploy/remote-download",
    auth,
    deployMiddle,
    controller.deploy.downloadRemoteFile
  );

  // {服务器名字:'host,password'}
  // 获取服务器列表
  router.get("/deploy/hosts", auth, deployMiddle, controller.deploy.getHosts);
  // 获取服务器列表
  router.post("/deploy/hosts", auth, deployMiddle, controller.deploy.postHosts);
  // 获取服务器列表
  router.delete("/deploy/hosts", auth, deployMiddle, controller.deploy.deleteHost);
  // 获取配置列表
  router.get(
    "/deploy/configs",
    auth,
    deployMiddle,
    controller.deploy.getConfigs
  );
  // 获取配置
  router.get("/deploy/config", auth, deployMiddle, controller.deploy.getConfig);
  // 上传配置
  router.post(
    "/deploy/config",
    auth,
    deployMiddle,
    controller.deploy.postConfig
  );
  // 删除配置
  router.delete(
    "/deploy/config",
    auth,
    deployMiddle,
    controller.deploy.deleteConfig
  );

  // 获取脚本列表
  router.get(
    "/deploy/scripts",
    auth,
    deployMiddle,
    controller.deploy.getScripts
  );
  // 获取脚本
  router.get("/deploy/script", auth, deployMiddle, controller.deploy.getScript);
  // 更新脚本
  router.post(
    "/deploy/script",
    auth,
    deployMiddle,
    controller.deploy.postScript
  );
  // 删除脚本
  router.delete(
    "/deploy/script",
    auth,
    deployMiddle,
    controller.deploy.deleteScript
  );
  router.post(
    "/deploy/script/run",
    auth,
    deployMiddle,
    controller.deploy.scriptRun
  );

  // 获取编排列表
  router.get("/deploy/bats", auth, deployMiddle, controller.deploy.getBats);
  // 获取编排
  router.get("/deploy/bat", auth, deployMiddle, controller.deploy.getbat);
  // 新增编排
  router.post("/deploy/bat", auth, deployMiddle, controller.deploy.postBat);
  // 删除编排
  router.delete("/deploy/bat", auth, deployMiddle, controller.deploy.deleteBat);
  // 更新编排
  router.post(
    "/deploy/bat-item",
    auth,
    deployMiddle,
    controller.deploy.postBatItem
  );
  // 删除部署
  router.delete(
    "/deploy/bat-item",
    auth,
    deployMiddle,
    controller.deploy.deleteBatItem
  );
  // 获取脚本列表
  router.get(
    "/deploy/deploys",
    auth,
    deployMiddle,
    controller.deploy.getDeploys
  );

  // 部署
  router.post(
    "/deploy/deploy",
    auth,
    deployMiddle,
    controller.deploy.postDeploy
  );
  router.post("/deploy/run", auth, deployMiddle, controller.deploy.postRun);
  router.post(
    "/deploy/script/detail",
    auth,
    deployMiddle,
    controller.deploy.scriptDetail
  );
  router.post(
    "/deploy/script/delete",
    auth,
    deployMiddle,
    controller.deploy.scriptDelete
  );

  // 获取正在部署的
  router.get("/deploy/deployings", auth, controller.deploy.getDeployings);

  // 获取部署
  router.delete(
    "/deploy/deploying",
    auth,
    deployMiddle,
    controller.deploy.deleteDeploying
  );

  // 申请证书
  router.post(
    "/deploy/deploy-ssl",
    auth,
    deployMiddle,
    controller.deploy.postDeploySsl
  );

  router.get(
    "/deploy/api_auto",
    auth,
    deployMiddle,
    controller.deploy.getApiAuto
  );

  // 注册
  router.post("/deploy/register", controller.deploy.postRegister);
  // 登陆
  router.post("/deploy/login", controller.deploy.postLogin);
  // 自更新
  router.post("/deploy/selfupdate", auth, controller.deploy.selfUpdate);
  // 记录列表
  router.get(
    "/deploy/recordList",
    auth,
    deployMiddle,
    controller.deploy.getRecordList
  );
  // 删除记录数据
  router.post(
    "/deploy/recordDelete",
    auth,
    deployMiddle,
    controller.deploy.postRecordDelete
  );
  // 获取环境列表
  router.get("/deploy/env/list", auth, controller.env.getList);
  // 新建环境
  router.post("/deploy/env/one", auth, controller.env.postOne);
  // 删除配置
  router.delete("/deploy/env/one", auth, controller.env.deleteOne);

  const { client } = app.config.mongoose;
  mongoose
    .connect(client.url, client.options)
    .then(() => {
      console.log("MongoDB connected successfully");
      app.listen(app.config.port, () => {
        console.log(`Server is running at http://localhost:${app.config.port}`);
      });
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err);
    });
};
