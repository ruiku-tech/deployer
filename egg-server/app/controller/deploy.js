const { Controller } = require("egg");
const dayjs = require("dayjs");
const utils = require("../service/utils");
const { log, error } = require("console");
const { isObjectEqual } = require("../service/record");
const fs = require("fs");
const path = require("path");
const config = require("../service/config");
const pump = require("mz-modules/pump");
const database = require("../service/database");
const access = require('./../service/access');
const disk = require("../service/disk");
const speakeasy = require("speakeasy");
const { randomUUID } = require('crypto');
const userFile = config.userFile();
const util = require("util");

const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);
// 初始化环境
const workspaceDir = config.workspace;
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
      ctx.body = { data, notes: Object.fromEntries(database.listNotes(req.headers.env, 'var').map(row => [row.name, row.note])) };
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
      if (req.body.note !== undefined && req.body.name) database.setNote(req.headers.env, 'var', req.body.name, req.body.note);
      ctx.body = { data };
    } catch (err) {
      ctx.body = { err };
    }
  }

  async getResourceNotes(ctx) {
    const { type } = ctx.query;
    ctx.assert(['var', 'host', 'config', 'script', 'bat'].includes(type), 400, '备注类型无效');
    ctx.body = { data: Object.fromEntries(database.listNotes(ctx.headers.env, type).map(row => [row.name, row.note])) };
  }

  async postResourceNote(ctx) {
    const type = ctx.request.body.type;
    const name = ctx.request.body.name;
    ctx.assert(['var', 'host', 'config', 'script', 'bat'].includes(type), 400, '备注类型无效');
    ctx.assert(typeof name === 'string' && name && !/[\\/\0]/.test(name), 400, '名称无效');
    database.setNote(ctx.headers.env, type, name, ctx.request.body.note || '');
    ctx.body = { data: 'success' };
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
    const requestId = randomUUID();
    const clientUploadId = ctx.request.headers['x-upload-id'];
    const uploadId = typeof clientUploadId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(clientUploadId) ? clientUploadId : requestId;
    const trace = (event, details = {}) => ctx.logger?.info('[Upload] %j', {
      event, requestId, uploadId, username: ctx.state?.user?.username,
      env: ctx.request.headers.env, ip: ctx.ip, ...details,
    });
    const sizeHeader = ctx.request.headers['x-file-size'];
    const expectedSize = sizeHeader === undefined ? null : Number(sizeHeader);
    ctx.assert(expectedSize === null || (sizeHeader !== '' && Number.isSafeInteger(expectedSize) && expectedSize >= 0), 400, '上传文件大小无效');
    trace('received', { expectedSize });
    try {
      await disk.requireSpace(workspaceDir, expectedSize ?? (Number(ctx.request.length) || 0));
    } catch (err) {
      trace('rejected', { error: err.message });
      ctx.status = err.code === 'ENOSPC' ? 507 : 500;
      ctx.body = { message: err.message };
      return;
    }
    const stream = await ctx.getFileStream();
    const { request: req } = ctx;
    const memos = req.headers.memo;
    const memo = memos ? decodeURIComponent(escape(atob(memos))) : "";

    const time = dayjs().format("YYYYMMDD-HH:mm:ss.SSS");
    const originalName = path.basename(stream.filename);
    // 确保目标目录存在
    await fs.promises.mkdir(req.context.fileDir, { recursive: true });
    let fileName;
    let targetPath;
    let fileHandle;
    let suffix = 0;
    while (!fileHandle) {
      fileName = `${time}${suffix ? `-${suffix}` : ''}~${originalName}`;
      targetPath = path.resolve(req.context.fileDir, fileName);
      try { fileHandle = await fs.promises.open(targetPath, 'wx'); }
      catch (err) {
        if (err.code !== 'EEXIST') throw err;
        suffix++;
      }
    }
    // Write directly to the timestamped package so its size remains visible
    // while uploading; remove it if the request is interrupted or incomplete.
    const writeStream = fileHandle.createWriteStream();
    trace('writing', { fileName });
    const abort = () => stream.destroy(new Error('上传已中断，请重新上传'));
    ctx.req?.once('aborted', abort);
    let receivedSize;
    // 使用 pump 将文件流传输到写流
    try {
      if (ctx.req?.aborted) abort();
      await pump(stream, disk.uploadGuard(workspaceDir), writeStream);
      receivedSize = (await fs.promises.stat(targetPath)).size;
      if (stream.truncated || ctx.req?.aborted || (expectedSize !== null && receivedSize !== expectedSize)) {
        const err = new Error('上传文件不完整，请重新上传');
        err.status = 400;
        throw err;
      }
    } catch (err) {
      const receivedSize = await fs.promises.stat(targetPath).then(stat => stat.size, () => null);
      trace('failed', { fileName, receivedSize, expectedSize, error: err.message });
      await fs.promises.unlink(targetPath).catch(() => {});
      ctx.status = err.code === 'ENOSPC' ? 507 : err.status || 500;
      ctx.body = { message: err.code === 'ENOSPC' ? '服务器磁盘空间不足，请清理文件后重试' : err.message };
      return;
    } finally {
      ctx.req?.removeListener('aborted', abort);
    }
    try {
      database.createFileMemo({ fileName, memo });
    } catch (err) {
      trace('failed', { fileName, receivedSize, expectedSize, error: err.message });
      await fs.promises.unlink(targetPath).catch(() => {});
      console.error("Error saving file memo:", err);
      ctx.status = 500;
      ctx.body = { message: '保存上传文件失败，请重新上传' };
      return;
    }

    trace('completed', { fileName, receivedSize });
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
    ctx.assert(typeof fileName === 'string' && !/[\\/\0]/.test(fileName) && !['.', '..'].includes(fileName), 400, '文件名无效');
    access.assertEnv(ctx, targetEnv);

    if (targetEnv === env) {
      ctx.body = { data: "success" };
      return;
    }

    console.log("req", req.body, "currEnv:{}", req.headers.env);
    const basePath = config.workspace;
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
    try {
      ctx.assert(!(await fs.promises.lstat(currentFilePath)).isSymbolicLink(), 400, '文件不允许为符号链接');
      await disk.requireSpace(workspaceDir, (await fs.promises.stat(currentFilePath)).size);
    } catch (err) {
      ctx.status = err.status || (err.code === 'ENOSPC' ? 507 : 500);
      ctx.body = { message: err.message };
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
      ctx.status = err.code === 'ENOSPC' ? 507 : 500;
      ctx.body = { message: err.code === 'ENOSPC' ? '服务器磁盘空间不足，请清理文件后重试' : '复制文件失败' };
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
    const { serverName, filePath, fileSize } = req.query;

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
      // 前端从文件列表里已知文件大小，通过 fileSize 参数传过来，用于浏览器计算下载进度
      if (fileSize && !isNaN(Number(fileSize))) {
        ctx.set('Content-Length', fileSize);
      }

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

      ctx.body = { data: ret, notes: Object.fromEntries(database.listNotes(req.headers.env, 'host').map(row => [row.name, row.note])) };
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
    for (const [name, value] of Object.entries(req.body.data || {})) {
      ctx.assert(typeof value === 'string', 400, '服务器配置无效');
      const parts = value.split(':');
      if (!parts[1]) {
        ctx.assert(data[name], 400, '请输入服务器密码或密钥');
        parts[1] = data[name].split(':')[1];
      }
      data[name] = parts.join(':');
    }
    try {
      await writeFile(
        req.context.hostsFile,
        JSON.stringify(data, null, 2),
        "utf-8"
      );
      if (req.body.notes && typeof req.body.notes === 'object') {
        for (const [name, note] of Object.entries(req.body.notes)) database.setNote(req.headers.env, 'host', name, note);
      }
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
      ctx.body = { data: files.map((name) => ({ name, note: database.getNote(req.headers.env, 'config', name) })) };
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
      database.setNote(req.headers.env, 'config', name, req.body.note);
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
      ctx.body = { data: files.map((name) => ({ name, note: database.getNote(req.headers.env, 'script', name) })) };
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
      database.setNote(req.headers.env, 'script', name, req.body.note);
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
      ctx.body = { data: files.map((name) => ({ name, note: database.getNote(req.headers.env, 'bat', name) })) };
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
      database.setNote(req.headers.env, 'bat', name, req.body.note);
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
      database.setNote(req.headers.env, 'bat-item', `${req.body.name}:${name}`, req.body.data.note);

      await writeFile(filePath, JSON.stringify(json), "utf-8");
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

      await writeFile(filePath, JSON.stringify(json), "utf-8");
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
    const { request: req } = ctx;
    const env = req.headers.env;
    ctx.assert(!req.body.env || req.body.env === env, 400, '环境不匹配');
    const payload = { list: req.body.list, files: req.body.files || {} };
    try {
      if (req.body.runAt) {
        const id = await ctx.service.releases.create(env, payload, ctx.state.user.username, Number(req.body.runAt));
        ctx.body = { data: { id } };
      } else {
        ctx.service.releases.prepare(env, payload);
        const job = ctx.app.createAnonymousContext();
        job.service.releases.execute(env, payload, ctx.state.user.username).catch(err => ctx.logger.error('发布失败: %s', err.message));
        ctx.body = { data: 'success' };
      }
    } catch (err) {
      ctx.status = 400;
      ctx.body = { message: err.message };
    }
  }
  async scriptDetail(ctx) {
    const { request: req, response: res } = ctx;
    // 查询文档并按时间倒序排序，进行分页
    const scripts = database.findScriptRecords(req.headers.env, access.isAdmin(access.user(ctx.state.user.username)));

    // 获取总文档数量，用于计算总页数
    // const totalDocuments = await fileDocument.countDocuments();
    // const totalPages = Math.ceil(totalDocuments / pageSize);
    ctx.body = { data: scripts };
  }
  async scriptDelete(ctx) {
    const { request: req, response: res } = ctx;
    database.deleteScriptRecord(req.body.text, req.headers.env, access.isAdmin(access.user(ctx.state.user.username)));
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
      try { database.createScriptRecord({ text, env: req.headers.env }); } catch(e) {}
    }
    database.createRecord({
      cmds: [req.body.cmd],
      host: req.body.server,
      name: '~运行~',
      username: ctx.state.user.username,
      time: Date.now(),
      env: req.headers.env || '',
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
    const env = ctx.headers.env;
    access.assertEnv(ctx, env);
    ctx.body = { data: ctx.service.executer.getDeployings(env) };
  }

  // 获取部署
  async deleteDeploying(ctx) {
    const { request: req, response: res } = ctx;
    const host = req.query.host;
    ctx.service.executer.stopDeploy(host, req.headers.env);
    ctx.body = { data: "sccess" };
  }

  // 注册
  async postRegister(ctx) {
    const { request: req, response: res } = ctx;
    const secret =
      process.env.DEPLOY_KEY ||
      "EQQWMZ2IKRXHSQLCFBNEAS2JEFZHQMTOFIVEO6RJIZGHO2CAMRNA";
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
      ctx.assert(typeof req.body.username === 'string' && req.body.username.trim().length > 0 && typeof req.body.password === 'string' && req.body.password.length >= 6, 400, '用户名或密码无效');
      access.register(req.body.username, req.body.password);
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
      access.init();
      const users = database.findUsers({
        username: req.body.username,
        password: req.body.password,
      });
      if (users.length > 0 && !users[0].disabled) {
        const token = require('../service/session').issueToken(ctx.app, req.body.username);
        database.createRecord({
          cmds: [],
          host: req.ip,
          name: "登录",
          username: req.body.username,
          time: Date.now(),
        });
        ctx.body = { data: { username: req.body.username, role: users[0].role, token: token } };
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
    const env = req.headers.env;
    try {
      const records = database.findRecords({ page: Number(page), pageSize: Number(pageSize), env });
      const total = database.countRecords(env);
      ctx.body = { data: { list: records, page, total } };
    } catch (err) {
      ctx.body = { data: "暂无记录" };
    }
  }
  // 删除记录数据
  async postRecordDelete(ctx) {
    const { request: req, response: res } = ctx;
    const item = { ...(req.body.item || {}) };
    ctx.assert(!item.env || item.env === req.headers.env, 403, '无权删除此记录');
    if (item.id) {
      const row = database.getDb().prepare('SELECT env FROM records WHERE id=?').get(item.id);
      ctx.assert(row && row.env === req.headers.env, 403, '无权删除此记录');
    } else item.env = req.headers.env;
    const result = database.deleteRecord(item);
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

  // 检测脚本在哪些部署编排中被使用
  async getScriptUsage(ctx) {
    const { request: req } = ctx;
    const scriptName = req.query.name;
    if (!scriptName) {
      ctx.body = { err: '请提供脚本名称' };
      return;
    }
    try {
      const batFiles = await readdir(req.context.batDir);
      const usages = [];
      for (const batFile of batFiles) {
        const filePath = path.resolve(req.context.batDir, batFile);
        try {
          const data = await readFile(filePath, 'utf-8');
          const json = JSON.parse(data);
          for (const [itemName, itemValue] of Object.entries(json)) {
            if (Array.isArray(itemValue.cmds) && itemValue.cmds.includes(scriptName)) {
              usages.push({ compose: batFile, item: itemName });
            }
          }
        } catch (e) {
          // 跳过无法解析的编排文件
        }
      }
      ctx.body = { data: usages };
    } catch (err) {
      ctx.body = { err: err.message };
    }
  }

  async selfUpdate(ctx) {
    access.assertAdmin(ctx);
    try {
      const version = ctx.request.body.version || null;
      await utils.selfUpdate(version);
      ctx.body = {
        data: version
          ? `升级任务已交给 PM2，目标版本 ${version}，服务将在更新完成后自动重启`
          : "升级任务已交给 PM2，服务将在更新完成后自动重启"
      };
    } catch (error) {
      console.error("启动升级失败:", error);
      ctx.body = { err: "启动升级失败: " + error.message };
    }
  }

  // 获取最近5个版本列表
  async getVersions(ctx) {
    const axios = require("axios");
    const currentVersion = utils.getCurrentVersion();

    try {
      const response = await axios.get(
        "https://api.github.com/repos/ruiku-tech/deployer/releases?per_page=5",
        { headers: { "User-Agent": "deployer-app" } }
      );

      const versions = response.data.map((release, index) => ({
        tag: release.tag_name,
        name: release.name || release.tag_name,
        publishedAt: release.published_at,
        releaseNotes: release.body || "",
        hasAsset: release.assets && release.assets.length > 0,
        isLatest: index === 0,
      }));

      ctx.body = { data: { currentVersion, versions } };
    } catch (error) {
      console.error("获取版本列表失败:", error.message);
      ctx.body = {
        data: { currentVersion, versions: [], error: error.message }
      };
    }
  }

  // 获取版本信息（保留旧接口兼容）
  async getVersionInfo(ctx) {
    const axios = require("axios");
    const currentVersion = utils.getCurrentVersion();

    try {
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
