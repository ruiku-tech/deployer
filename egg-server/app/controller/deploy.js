const { Controller } = require("egg");
const dayjs = require("dayjs");
const cert = require("../service/cert");
const utils = require("../service/utils");
const multer = require("multer");
const { log, error } = require("console");
const { isObjectEqual } = require("../service/record");
const fs = require("fs");
const path = require("path");
const config = require("../service/config");
const pump = require("mz-modules/pump");
const database = require("../service/database");
const speakeasy = require("speakeasy");
const userFile = config.userFile();
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, req.context.fileDir); // 上传文件的存储路径
  },
  filename(req, file, cb) {
    const now = dayjs();
    const time = now.format("YYYYMMDD-HH:mm:ss");
    cb(null, `${time}~${file.originalname}`); // 上传文件的文件名
  },
});
const upload = multer({
  storage,
});
const util = require("util");

const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);
// 初始化环境
const workspaceDir = path.resolve(__dirname, "../../workspace");
if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir);
}
class DeployController extends Controller {
  queryFileStat(filePath) {
    return new Promise((rs, rj) => {
      fs.stat(filePath, (err, stat) => {
        if (err) {
          return rs(`err:${err.code}`);
        }
        rs(`${(stat.size / 1000000).toFixed(3)}M(${stat.size})`);
      });
    });
  }
  // 获取变量
  async getVars(ctx) {
    const { request: req, response: res } = ctx;
    try {
      const data = await readFile(req.context.varsFile, "utf-8");
      ctx.body = { data };
    } catch (err) {
      ctx.body = { err };
    }
  }

  // 更新配置
  async updateVars(ctx) {
    const { request: req, response: res } = ctx;

    try {
      const data = await writeFile(
        req.context.varsFile,
        req.body.data,
        "utf-8"
      );
      ctx.body = { data };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 获取文件列表
  async getFiles(ctx) {
    const { request: req, response: res } = ctx;

    try {
      // 读取文件目录
      const files = await readdir(req.context.fileDir);
      ctx.body = { data: files.map((file) => ({ file })) };
    } catch (err) {
      ctx.body = { err: err.message };
    }
  }

  // 获取文件列表及文件大小
  async getFilesStat(ctx) {
    const { request: req, response: res } = ctx;
    try {
      const files = await readdir(req.context.fileDir);
      const stats = await Promise.all(
        files.map((file) =>
          this.queryFileStat(path.resolve(req.context.fileDir, file))
        )
      );
      const memos = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileMemoRow = database.findOneFileMemo(file);
        if (fileMemoRow) {
          memos[i] = fileMemoRow.memo;
        } else {
          memos[i] = "";
        }
      }
      ctx.body = {
        data: files.map((file, index) => ({
          file,
          size: stats[index],
          memo: memos[index],
        })),
      };
    } catch (err) {
      ctx.body = { err };
    }
  }

  // 文件上传
  async uploadFile(ctx) {
    const stream = await ctx.getFileStream();
    const { request: req } = ctx;
    const memos = req.headers.memo;
    const memo = memos ? decodeURIComponent(escape(atob(memos))) : "";

    const time = dayjs().format("YYYYMMDD-HH:mm:ss");
    const baseName = `${time}~${path.basename(stream.filename)}`;
    const fileName = memo ? `${baseName}` : baseName;
    // const fileName = memo ? `${baseName}||${memo}` : baseName;
    // 生成目标文件路径
    const targetPath = path.resolve(req.context.fileDir, fileName);
    // 确保目标目录存在
    await fs.promises.mkdir(req.context.fileDir, { recursive: true });
    // 创建写流
    const writeStream = fs.createWriteStream(targetPath);
    // 使用 pump 将文件流传输到写流
    await pump(stream, writeStream);
    try {
      database.createFileMemo({ fileName, memo });
    } catch (err) {
      console.error("Error saving file memo:", err);
      ctx.throw(500, "Error saving file memo");
    }

    // 删除老的三个文件
    // const files = await fs.promises.readdir(req.context.fileDir);
    // console.log('删除老的三个文件' + files);
    // const sortedFiles = files.map(file => {
    //   const filePath = path.resolve(req.context.fileDir, file);
    //   return {
    //     file,
    //     time: fs.statSync(filePath).mtime.getTime(),
    //   };
    // }).sort((a, b) => b.time - a.time);
    // const filesToDelete = sortedFiles.slice(3).map(f => f.file);
    // for (const file of filesToDelete) {
    //   await fs.promises.unlink(path.resolve(req.context.fileDir, file));
    //   fileMemo.deleteOne({ fileName: file });
    // }
    ctx.body = { data: "success" };
  }

  async fileClone(ctx) {
    const { request: req, response: res } = ctx;
    const fileName = req.body.filename;
    const targetEnv = req.body.targetEnv;
    const env = req.headers.env;
    if (!fileName || !targetEnv || !env) {
      ctx.status = 400;
      ctx.body = { message: "Missing required parameters" };
      return;
    }

    if (targetEnv === env) {
      ctx.body = { data: "success" };
      return;
    }

    console.log("req", req.body, "currEnv:{}", req.headers.env);
    const basePath = path.resolve(__dirname, "../../workspace");
    const currentFilePath = path.resolve(basePath, env, "files", fileName);
    const targetFilePath = path.resolve(basePath, targetEnv, "files", fileName);

    try {
      await fs.promises.access(currentFilePath, fs.constants.F_OK);
    } catch (err) {
      console.error("Error: Source file does not exist.", err);
      ctx.status = 404;
      ctx.body = { message: "Source file does not exist" };
      return;
    }

    // 确保目标目录存在
    const targetDir = path.dirname(targetFilePath);
    try {
      await fs.promises.mkdir(targetDir, { recursive: true });
    } catch (err) {
      console.error("Error creating target directory:", err);
      ctx.status = 500;
      ctx.body = { message: "Error creating target directory" };
      return;
    }

    // 复制文件
    try {
      await fs.promises.copyFile(currentFilePath, targetFilePath);
      ctx.body = { data: "success" };
    } catch (err) {
      console.error("Error copying file:", err);
      ctx.status = 500;
      ctx.body = { message: "Error copying file" };
    }
  }

  // 获取服务器列表
  async deleteFile(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const filePath = path.resolve(req.context.fileDir, name);

    try {
      const data = await unlink(filePath);
      ctx.body = { data };
    } catch (err) {
      ctx.body = { err };
    }
  }

  // 获取远程服务器文件列表
  async getRemoteFiles(ctx) {
    const { request: req } = ctx;
    const { serverName, path: remotePath } = req.query;

    if (!serverName || !remotePath) {
      ctx.status = 400;
      ctx.body = { err: '缺少必要参数' };
      return;
    }

    try {
      const env = req.headers.env || 'dsc';
      const files = await ctx.service.remote.listFiles(
        serverName,
        remotePath,
        env
      );
      ctx.body = { data: files };
    } catch (err) {
      console.error('获取远程文件列表失败:', err);
      ctx.status = 500;
      ctx.body = { err: err.message };
    }
  }

  // 下载远程服务器文件
  async downloadRemoteFile(ctx) {
    const { request: req } = ctx;
    const { serverName, filePath } = req.query;

    if (!serverName || !filePath) {
      ctx.status = 400;
      ctx.body = { message: '缺少必要参数' };
      return;
    }

    try {
      const env = req.headers.env || 'dsc';
      const fileStream = await ctx.service.remote.downloadFile(
        serverName,
        filePath,
        env
      );

      // 获取文件名
      const fileName = path.basename(filePath);

      // 设置响应头
      ctx.set('Content-Type', 'application/octet-stream');
      ctx.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

      // 返回文件流
      ctx.body = fileStream;
    } catch (err) {
      console.error('下载远程文件失败:', err);
      ctx.status = 500;
      ctx.body = { message: '下载文件失败: ' + err.message };
    }
  }

  // {服务器名字:'host,password'}
  // 获取服务器列表
  async getHosts(ctx) {
    const { request: req, response: res } = ctx;
    try {
      const data = await readFile(req.context.hostsFile, "utf-8");
      let ret = {};
      try {
        const jsonData = JSON.parse(data);
        ret = Object.entries(jsonData).reduce((ret, item) => {
          const [host,password,port = 22] = item[1].split(":")
          ret[item[0]] = `${host}:${password.substring(0,2)}****${password.substring(password.length-2)}:${port}`;
          return ret;
        }, {});
      } catch (error) {}

      ctx.body = { data: ret };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 获取服务器列表
  async postHosts(ctx) {
    const { request: req, response: res } = ctx;

    const data = {};
    if (fs.existsSync(req.context.hostsFile)) {
      const localData = await readFile(req.context.hostsFile, "utf-8");
      try {
        const jsonData = JSON.parse(localData);
        Object.assign(data, jsonData);
      } catch (error) {
        console.log("本地解析已存在的配置失败");
      }
    }
    Object.assign(data, req.body.data);
    try {
      await writeFile(
        req.context.hostsFile,
        JSON.stringify(data, null, 2),
        "utf-8"
      );
      ctx.body = { data: "success" };
    } catch (err) {
      ctx.body = { err };
    }
  }

  async deleteHost(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    if (fs.existsSync(req.context.hostsFile)) {
      const localData = await readFile(req.context.hostsFile, "utf-8");
      try {
        const jsonData = JSON.parse(localData);
        delete jsonData[name];
        await writeFile(
          req.context.hostsFile,
          JSON.stringify(jsonData, null, 2),
          "utf-8"
        );
      } catch (error) {
        ctx.body = { err: error.message };
        return;
      }
    }
    ctx.body = { data: "success" };
  }

  // 获取配置列表
  async getConfigs(ctx) {
    const { request: req, response: res } = ctx;
    const context = req.context;

    try {
      const files = await readdir(context.configDir);
      ctx.body = { data: files.map((name) => ({ name })) };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 获取配置
  async getConfig(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.configDir, name);

    try {
      const data = await readFile(filePath, "utf-8");
      ctx.body = { data };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 上传配置
  async postConfig(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.body.name;
    const context = req.context;
    const filePath = path.resolve(context.configDir, name);

    try {
      await writeFile(filePath, req.body.data, "utf-8");
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 删除配置
  async deleteConfig(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.configDir, name);

    try {
      await unlink(filePath);
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }

  // 获取脚本列表
  async getScripts(ctx) {
    const { request: req, response: res } = ctx;
    const context = req.context;

    try {
      const files = await readdir(context.scriptDir);
      ctx.body = { data: files.map((name) => ({ name })) };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 获取脚本
  async getScript(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.scriptDir, name);

    try {
      const data = await readFile(filePath, "utf-8");
      ctx.body = { data };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 更新脚本
  async postScript(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.body.name;
    const context = req.context;
    const filePath = path.resolve(context.scriptDir, name);

    try {
      await writeFile(filePath, req.body.data, "utf-8");
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 删除脚本
  async deleteScript(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.scriptDir, name);

    try {
      await unlink(filePath);
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }

  // 获取编排列表
  async getBats(ctx) {
    const { request: req, response: res } = ctx;

    try {
      const files = await readdir(req.context.batDir);
      ctx.body = { data: files.map((name) => ({ name })) };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 获取编排
  async getbat(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const filePath = path.resolve(req.context.batDir, name);

    try {
      const data = await readFile(filePath, "utf-8");
      ctx.body = {
        data: data ? JSON.parse(data) : `编排组合[${name}]未找到`,
      };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 新增编排
  async postBat(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.body.name;
    const context = req.context;
    const filePath = path.resolve(context.batDir, name);
    const exist = fs.existsSync(filePath);
    if (exist) {
      return (ctx.body = { err: "编排已存在" });
    }

    try {
      const data = await writeFile(filePath, "{}", "utf-8");
      ctx.body = { data };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 删除编排
  async deleteBat(ctx) {
    const { request: req, response: res } = ctx;
    const context = req.context;
    const name = req.query.name;
    const filePath = path.resolve(context.batDir, name);

    try {
      await unlink(filePath);
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 更新编排
  async postBatItem(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.body.name;
    const context = req.context;
    const filePath = path.resolve(context.batDir, name);

    try {
      const data = await readFile(filePath, "utf-8");
      const json = JSON.parse(data);
      const { name, ...rest } = req.body.data;
      json[name] = rest;

      writeFile(filePath, JSON.stringify(json), "utf-8");
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 删除部署
  async deleteBatItem(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.batDir, name);

    try {
      const data = await readFile(filePath, "utf-8");
      const json = JSON.parse(data);
      delete json[req.query.item];

      writeFile(filePath, JSON.stringify(json), "utf-8");
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 获取脚本列表
  async getDeploys(ctx) {
    const { request: req, response: res } = ctx;

    try {
      const files = await readdir(req.context.deployDir);
      ctx.body = { data: files };
    } catch (err) {
      ctx.body = { err };
    }
  }

  // 部署
  async postDeploy(ctx) {
    const { request: req, response: res } = ctx;
    // [{name:string,host:string,cmds:string[]}]
    let list = req.body.list;
    const env = req.body.env;
    const recordList = list.map((item) => ({
      ...item,
      username: ctx.state.user.username,
    }));
    if (!list || !list.length) {
      return (ctx.body = { err: "请选择部署的脚本" });
    }
    const vars = utils.parseVars.call(req.context);
    const hosts = utils.parseHosts.call(req.context);
    const context = Object.assign(
      { vars, hosts, files: req.body.files },
      req.context
    );
    list = ctx.service.executer.parse(env, context, list);
    const parseErrs = list.filter((item) => item.err);
    if (parseErrs.length) {
      return (ctx.body = {
        err: parseErrs.map((item) => item.err).join(","),
      });
    }
    // 记录部署记录
    // fs.writeFile(
    //   path.resolve(
    //     req.context.deployDir,
    //     `${dayjs().format('YYYYMMDD-HH:mm:ss')}.txt`
    //   ),
    //   JSON.stringify(list, null, 2),
    //   'utf-8',
    //   () => {}
    // );
    const user = database.createRecords(recordList);
    try {
      ctx.service.executer.deployList(list);
      ctx.body = { data: user };
    } catch (err) {
      ctx.body = { err };
    }
  }
  async scriptDetail(ctx) {
    const { request: req, response: res } = ctx;
    // 查询文档并按时间倒序排序，进行分页
    const scripts = database.findScriptRecords();

    // 获取总文档数量，用于计算总页数
    // const totalDocuments = await fileDocument.countDocuments();
    // const totalPages = Math.ceil(totalDocuments / pageSize);
    ctx.body = { data: scripts };
  }
  async scriptDelete(ctx) {
    const { request: req, response: res } = ctx;
    database.deleteScriptRecord(req.body.text);
    ctx.body = { data: "success" };
  }

  async postRun(ctx) {
    const { request: req, response: res } = ctx;
    const hosts = utils.parseHosts.call(req.context);
    const server = hosts[req.body.server];
    if (!server) {
      return (ctx.body = { err: `找不到服务器:${req.body.server}` });
    }
    const text = req.body.cmd;
    if (req.body.cache) {
      try { database.createScriptRecord({ text }); } catch(e) {}
    }
    database.createRecord({
      cmds: [req.body.cmd],
      host: req.body.server,
      name: "~运行~",
      username: ctx.state.user.username,
      time: Date.now(),
    });
    
    // 解析脚本：将脚本名转换为命令数组
    const vars = utils.parseVars.call(req.context);
    const env = req.headers.env || 'default';
    const context = Object.assign(
      { vars, hosts },
      req.context
    );
    
    const list = ctx.service.executer.parseSingleCmds(env, context, [{
      host: req.body.server,
      cmds: [req.body.cmd]
    }]);
    
    // 检查解析错误
    if (list[0]?.err) {
      return (ctx.body = { err: list[0].err });
    }
    
    // 执行已解析的命令
    await ctx.service.executer
      .deply(list[0])
      .then(() => {
        ctx.body = { data: "success" };
      })
      .catch((err) => {
        ctx.body = { err };
      });
  }

  // 获取正在部署的
  async getDeployings(ctx) {
    ctx.body = { data: ctx.service.executer.getDeployings() };
  }

  // 获取部署
  async deleteDeploying(ctx) {
    const { request: req, response: res } = ctx;
    const host = req.query.host;
    ctx.service.executer.stopDeploy(host);
    ctx.body = { data: "sccess" };
  }

  // 申请证书
  async postDeploySsl(ctx) {
    const { request: req, response: res } = ctx;
    const domain = req.body.domain;
    const hosts = utils.parseHosts.call(req.context);
    const server = hosts[req.body.server];
    if (!server) {
      return (ctx.body = { err: `找不到服务器:${req.body.server}` });
    }
    await cert
      .requestCertificate(server, domain, ctx)
      .then(() => {
        ctx.body = { data: "sccess" };
      })
      .catch((err) => {
        ctx.body = { err };
      });
  }

  async getApiAuto(ctx) {
    const { request: req, response: res } = ctx;
    // apiAuto.init(req.query.host);
    try {
      const ApiTester = require("../api_test/index");
      global.isTest = false;
      new ApiTester({
        host: `${req.query.host}:${req.query.port}`,
        prefix: `${req.query.prefix}`,
      }).run();
      ctx.body = { data: "sccess" };
    } catch (error) {
      ctx.body = { error };
    }
  }

  // 注册
  async postRegister(ctx) {
    const { request: req, response: res } = ctx;
    console.log("谷歌密钥环境变量", process.env.DEPLOY_KEY);
    const secret =
      process.env.DEPLOY_KEY ||
      "EQQWMZ2IKRXHSQLCFBNEAS2JEFZHQMTOFIVEO6RJIZGHO2CAMRNA";
    console.log("!!!!secret", secret);
    const verified = speakeasy.totp.verify({
      secret, // 使用生成的密钥
      encoding: "base32",
      token: req.body.code, // 用户从 Google Authenticator 中获取的验证码
      window: 1, // 容忍的时间窗口
    });

    if (!verified) {
      return (ctx.body = { err: { code: "code码错误" } });
    }
    const jsonData = database.findUsers({ username: req.body.username });
    if (jsonData.length > 0) {
      return (ctx.body = { err: { code: "用户名已注册" } });
    }

    try {
      database.createUser({
        username: req.body.username,
        password: req.body.password,
      });
      database.createRecord({
        cmds: [],
        host: req.ip,
        name: "注册",
        username: req.body.username,
        time: Date.now(),
      });
      ctx.body = { data: "sccess" };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 登陆
  async postLogin(ctx) {
    const { request: req, response: res } = ctx;
    try {
      const users = database.findUsers({
        username: req.body.username,
        password: req.body.password,
      });
      if (users.length > 0) {
        const token = ctx.app.jwt.sign(
          { username: req.body.username },
          ctx.app.config.jwt.secret,
          { expiresIn: ctx.app.config.jwt.expiresIn }
        );
        database.createRecord({
          cmds: [],
          host: req.ip,
          name: "登录",
          username: req.body.username,
          time: Date.now(),
        });
        ctx.body = { data: { username: req.body.username, token: token } };
      } else {
        ctx.body = { err: { code: "用户名或密码错误" } };
      }
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 记录列表
  async getRecordList(ctx) {
    const { request: req, response: res } = ctx;
    const page = req.query.page || 1;
    const pageSize = req.query.pageSize || 30;
    try {
      const records = database.findRecords({ page: Number(page), pageSize: Number(pageSize) });
      const total = database.countRecords();
      ctx.body = { data: { list: records, page, total } };
    } catch (err) {
      ctx.body = { data: "暂无记录" };
    }
  }
  // 删除记录数据
  async postRecordDelete(ctx) {
    const { request: req, response: res } = ctx;
    const result = database.deleteRecord(req.body.item);
    if (result.changes >= 1) {
      ctx.body = { data: "success" };
    } else {
      ctx.body = { err: { code: "删除失败" } };
    }
  }
  // 运行脚本到指定服务器
  async scriptRun(ctx) {
    const { request: req, response: res } = ctx;
    const targetHost = req.body.host;
    const targetScriptName = req.body.cmd;
    const env = req.headers.env;
    console.log(
      "服务器名称：",
      targetHost,
      "脚本名称：",
      targetScriptName,
      "env:",
      env
    );

    let serverConfig = "";
    try {
      const hostsFilePath = path.resolve(req.context.hostsFile);
      const hostsData = await readFile(hostsFilePath, "utf-8");
      const hostsJson = JSON.parse(hostsData);
      serverConfig = hostsJson[targetHost];
      if (!serverConfig) {
        ctx.body = { err: `未找到服务器配置: ${targetHost}` };
        return;
      }
    } catch (err) {
      console.error("读取服务器列表文件失败：", err);
      ctx.body = { err: "服务器配置读取失败" };
      return;
    }
    const [host, password, port] = serverConfig.split(":");
    // 读取脚本文件的内容
    let scriptData;
    try {
      const scriptFilePath = path.resolve(
        req.context.scriptDir,
        targetScriptName
      );
      scriptData = await readFile(scriptFilePath, "utf-8");
    } catch (err) {
      console.error("读取脚本文件失败：", err);
      ctx.body = { err: "脚本读取失败" };
      return;
    }

    // 构造服务器对象
    const server = {
      host,
      password,
      port
    };
    const finalScript = utils.parseVars.call(scriptData);

    // 调用封装好的执行方法
    try {
      await ctx.service.executer.run(server, finalScript);
      ctx.body = { data: "success" };
    } catch (err) {
      console.error("脚本执行失败：", err);
      ctx.body = { err: "脚本执行失败" };
    }

    ctx.body = { data: "sccess" };
  }

  async selfUpdate(ctx) {
    try {
      utils.selfUpdate();
      ctx.body = { 
        data: "升级进程已启动，服务将在几分钟内自动重启" 
      };
    } catch (error) {
      console.error("启动升级失败:", error);
      ctx.body = { err: "启动升级失败: " + error.message };
    }
  }

  // 获取版本信息
  async getVersionInfo(ctx) {
    const axios = require("axios");
    const currentVersion = utils.getCurrentVersion();
    
    try {
      // 获取 GitHub 最新版本
      const response = await axios.get(
        "https://api.github.com/repos/ruiku-tech/deployer/releases/latest"
      );
      
      ctx.body = {
        data: {
          currentVersion,
          latestVersion: response.data.tag_name || "未知",
          latestVersionName: response.data.name || "最新版本",
          publishedAt: response.data.published_at,
          releaseNotes: response.data.body || "暂无更新说明",
        }
      };
    } catch (error) {
      console.error("获取最新版本失败:", error.message);
      ctx.body = {
        data: {
          currentVersion,
          latestVersion: "获取失败",
          error: error.message,
        }
      };
    }
  }

  // 获取迁移状态
  async getMigrateStatus(ctx) {
    const currentVersion = utils.getCurrentVersion();
    const migrated = database.isMigrated();
    ctx.body = {
      data: {
        currentVersion,
        migrated,
        needMigration: !migrated,
      }
    };
  }

  // 执行 MongoDB 到 SQLite 的数据迁移
  async postMigrate(ctx) {
    const { request: req } = ctx;
    const mongoUrl = req.body.mongoUrl;

    if (!mongoUrl) {
      ctx.status = 400;
      ctx.body = { err: '请提供 MongoDB 连接地址' };
      return;
    }

    if (database.isMigrated()) {
      ctx.body = { data: '数据已迁移过，无需重复迁移' };
      return;
    }

    let mongoose;
    try {
      mongoose = require('mongoose');
    } catch (e) {
      ctx.status = 500;
      ctx.body = { err: 'mongoose 未安装，请先运行: npm install mongoose' };
      return;
    }

    let conn;
    try {
      // 连接到 MongoDB
      conn = await mongoose.createConnection(mongoUrl, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 30000,
      }).asPromise();

      // 定义 Schema
      const UserSchema = new mongoose.Schema({
        username: String,
        password: String,
      });
      const RecordSchema = new mongoose.Schema({
        cmds: [String],
        host: String,
        name: String,
        username: String,
        time: Date,
      });
      const FileMemoSchema = new mongoose.Schema({
        fileName: String,
        memo: String,
        uploadTime: Date,
      });
      const ScriptRecordSchema = new mongoose.Schema({
        text: String,
        uploadTime: Date,
      });

      const UserModel = conn.model('User', UserSchema);
      const RecordModel = conn.model('Record', RecordSchema);
      const FileMemoModel = conn.model('FileMemo', FileMemoSchema);
      const ScriptRecordModel = conn.model('script_history', ScriptRecordSchema);

      // 读取所有数据
      const users = await UserModel.find({}).lean();
      const records = await RecordModel.find({}).lean();
      const fileMemos = await FileMemoModel.find({}).lean();
      const scriptRecords = await ScriptRecordModel.find({}).lean();

      // 导入到 SQLite
      database.importMigrationData({
        users,
        records,
        fileMemos,
        scriptRecords,
      });

      ctx.body = {
        data: {
          message: '迁移成功',
          stats: {
            users: users.length,
            records: records.length,
            fileMemos: fileMemos.length,
            scriptRecords: scriptRecords.length,
          }
        }
      };
    } catch (err) {
      console.error('迁移失败:', err);
      ctx.status = 500;
      ctx.body = { err: '迁移失败: ' + (err.message || String(err)) };
    } finally {
      if (conn) {
        try { await conn.close(); } catch (e) {}
      }
    }
  }
}
module.exports = DeployController;
