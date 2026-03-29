/**
 * @param {Egg.Application} app - egg application
 */
const database = require("./service/database");
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
  // 获取版本信息
  router.get("/deploy/version", auth, controller.deploy.getVersionInfo);
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
  // 导出环境配置
  router.get("/deploy/env/export", auth, controller.env.exportEnv);
  // 导入环境配置
  router.post("/deploy/env/import", auth, controller.env.importEnv);

  // 初始化 SQLite 数据库
  try {
    database.getDb();
    console.log("SQLite database initialized successfully");

    // 启动时自动检查：如果数据库没有用户且未迁移过，自动尝试从 MongoDB 迁移
    const users = database.findUsers();
    if (users.length === 0 && !database.isMigrated()) {
      const mongoConfig = app.config.mongoMigrate;
      const mongoUrl = mongoConfig && mongoConfig.url;
      if (mongoUrl) {
        console.log("检测到数据库为空且未迁移，自动尝试从 MongoDB 迁移...");
        (async () => {
          let mongoose;
          try {
            mongoose = require('mongoose');
          } catch (e) {
            console.warn("自动迁移跳过：mongoose 未安装，请手动安装后重启或手动迁移");
            return;
          }
          let conn;
          try {
            conn = await mongoose.createConnection(mongoUrl, {
              serverSelectionTimeoutMS: 15000,
              connectTimeoutMS: 30000,
            }).asPromise();

            const UserSchema = new mongoose.Schema({ username: String, password: String });
            const RecordSchema = new mongoose.Schema({ cmds: [String], host: String, name: String, username: String, time: Date });
            const FileMemoSchema = new mongoose.Schema({ fileName: String, memo: String, uploadTime: Date });
            const ScriptRecordSchema = new mongoose.Schema({ text: String, uploadTime: Date });

            const UserModel = conn.model('User', UserSchema);
            const RecordModel = conn.model('Record', RecordSchema);
            const FileMemoModel = conn.model('FileMemo', FileMemoSchema);
            const ScriptRecordModel = conn.model('script_history', ScriptRecordSchema);

            const [mongoUsers, records, fileMemos, scriptRecords] = await Promise.all([
              UserModel.find({}).lean(),
              RecordModel.find({}).lean(),
              FileMemoModel.find({}).lean(),
              ScriptRecordModel.find({}).lean(),
            ]);

            if (mongoUsers.length === 0) {
              console.log("MongoDB 中也没有用户数据，跳过自动迁移");
              return;
            }

            database.importMigrationData({
              users: mongoUsers,
              records,
              fileMemos,
              scriptRecords,
            });

            console.log(`自动迁移完成: ${mongoUsers.length} 用户, ${records.length} 记录, ${fileMemos.length} 文件备注, ${scriptRecords.length} 脚本记录`);
          } catch (err) {
            console.warn("自动迁移失败（MongoDB 可能不可用），可稍后手动迁移:", err.message);
          } finally {
            if (conn) {
              try { await conn.close(); } catch (e) {}
            }
          }
        })();
      } else {
        console.log("数据库为空且未配置 mongoMigrate.url，跳过自动迁移");
      }
    }
  } catch (err) {
    console.error("SQLite database initialization error:", err);
  }
};
