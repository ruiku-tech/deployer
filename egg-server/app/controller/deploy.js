const { Controller } = require('egg');
const dayjs = require('dayjs');
const cert = require('../service/cert');
const utils = require('../service/utils');
const multer = require('multer');
const { log, error } = require('console');
const { isObjectEqual } = require('../service/record');
const fs = require('fs');
const path = require('path');
const config = require('../service/config');
const pump = require('mz-modules/pump');
const fileMemo = require('../model/FileMemo');
const scriptRecord = require('../model/ScriptRecord');

const userFile = config.userFile();
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, req.context.fileDir); // 上传文件的存储路径
  },
  filename(req, file, cb) {
    const now = dayjs();
    const time = now.format('YYYYMMDD-HH:mm:ss');
    cb(null, `${time}~${file.originalname}`); // 上传文件的文件名
  },
});
const upload = multer({
  storage,
});
const util = require('util');

const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);
// 初始化环境
const workspaceDir = path.resolve(__dirname, '../../workspace');
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
      const data = await readFile(req.context.varsFile, 'utf-8');
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
        'utf-8'
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
        const fileMemos = await fileMemo
          .findOne({ fileName: file })
          .sort({ uploadTime: -1 });
        if (fileMemos) {
          memos[i] = fileMemos.memo;
        } else {
          memos[i] = '';
        }
      }
      ctx.body = {
        data: files.map((file, index) => ({ file, size: stats[index], memo: memos[index] })),
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
    const memo = memos ? decodeURIComponent(escape(atob(memos))) : '';

    const time = dayjs().format('YYYYMMDD-HH:mm:ss');
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
      const fileDocument = new fileMemo({ fileName, memo });
      await fileDocument.save();
    } catch (err) {
      console.error('Error saving file to MongoDB:', err);
      ctx.throw(500, 'Error saving file to MongoDB');
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
    ctx.body = { data: 'success' };
  }

  async fileClone(ctx) {
    const { request: req, response: res } = ctx;
    const fileName = req.body.filename;
    const targetEnv = req.body.targetEnv;
    const env = req.headers.env;
    if (!fileName || !targetEnv || !env) {
      ctx.status = 400;
      ctx.body = { message: 'Missing required parameters' };
      return;
    }

    if (targetEnv === env) {
      ctx.body = { data: 'success' };
      return;
    }

    console.log('req', req.body, 'currEnv:{}', req.headers.env);
    const basePath = path.resolve(__dirname, '../../workspace');
    const currentFilePath = path.resolve(basePath, env, 'files', fileName);
    const targetFilePath = path.resolve(basePath, targetEnv, 'files', fileName);

    try {
      await fs.promises.access(currentFilePath, fs.constants.F_OK);
    } catch (err) {
      console.error('Error: Source file does not exist.', err);
      ctx.status = 404;
      ctx.body = { message: 'Source file does not exist' };
      return;
    }

    // 确保目标目录存在
    const targetDir = path.dirname(targetFilePath);
    try {
      await fs.promises.mkdir(targetDir, { recursive: true });
    } catch (err) {
      console.error('Error creating target directory:', err);
      ctx.status = 500;
      ctx.body = { message: 'Error creating target directory' };
      return;
    }

    // 复制文件
    try {
      await fs.promises.copyFile(currentFilePath, targetFilePath);
      ctx.body = { data: 'success' };
    } catch (err) {
      console.error('Error copying file:', err);
      ctx.status = 500;
      ctx.body = { message: 'Error copying file' };
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
  // {服务器名字:'host,password'}
  // 获取服务器列表
  async getHosts(ctx) {
    const { request: req, response: res } = ctx;
    try {
      const data = await readFile(req.context.hostsFile, 'utf-8');
      let jsonData = '';
      try {
        jsonData = JSON.parse(data);
      } catch (error) {}

      ctx.body = { data: jsonData };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 获取服务器列表
  async postHosts(ctx) {
    const { request: req, response: res } = ctx;

    try {
      const data = await writeFile(
        req.context.hostsFile,
        JSON.stringify(req.body.data, null, 2),
        'utf-8'
      );
      ctx.body = { data: 'success' };
    } catch (err) {
      ctx.body = { err };
    }
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
      const data = await readFile(filePath, 'utf-8');
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
      await writeFile(filePath, req.body.data, 'utf-8');
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
      const data = await readFile(filePath, 'utf-8');
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
      await writeFile(filePath, req.body.data, 'utf-8');
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
      const data = await readFile(filePath, 'utf-8');
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
      return (ctx.body = { err: '编排已存在' });
    }

    try {
      const data = await writeFile(filePath, '{}', 'utf-8');
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
      const data = await readFile(filePath, 'utf-8');
      const json = JSON.parse(data);
      const { name, ...rest } = req.body.data;
      json[name] = rest;

      writeFile(filePath, JSON.stringify(json), 'utf-8');
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
      const data = await readFile(filePath, 'utf-8');
      const json = JSON.parse(data);
      delete json[req.query.item];

      writeFile(filePath, JSON.stringify(json), 'utf-8');
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
    const recordList = list;
    if (!list || !list.length) {
      return (ctx.body = { err: '请选择部署的脚本' });
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
        err: parseErrs.map((item) => item.err).join(','),
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
    const user = await ctx.model.Record.create(recordList);
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
    const scripts = await scriptRecord
      .find()
      .sort({ uploadTime: -1 }); // 按 uploadTime 倒序排序

    // 获取总文档数量，用于计算总页数
    // const totalDocuments = await fileDocument.countDocuments();
    // const totalPages = Math.ceil(totalDocuments / pageSize);
    ctx.body = { data: scripts };
  }
  async scriptDelete(ctx) {
    const { request: req, response: res } = ctx;
    await scriptRecord.deleteOne({ text: req.body.text });
    ctx.body = { data: 'success' };
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
      const fileDocument = new scriptRecord({ text });
      fileDocument.save().catch(() => {});
    }
    await ctx.service.executer
      .run(server, req.body.cmd)
      .then(() => {
        ctx.body = { data: 'success' };
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
    ctx.body = { data: 'sccess' };
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
        ctx.body = { data: 'sccess' };
      })
      .catch((err) => {
        ctx.body = { err };
      });
  }

  async getApiAuto(ctx) {
    const { request: req, response: res } = ctx;
    // apiAuto.init(req.query.host);
    try {
      const ApiTester = require('../api_test/index');
      global.isTest = false;
      new ApiTester({
        host: `${req.query.host}:${req.query.port}`,
        prefix: `${req.query.prefix}`,
      }).run();
      ctx.body = { data: 'sccess' };
    } catch (error) {
      ctx.body = { error };
    }
  }

  // 注册
  async postRegister(ctx) {
    const { request: req, response: res } = ctx;
    const jsonData = await ctx.model.User.find({
      username: req.body.username,
    });
    if (jsonData.length > 0) {
      return (ctx.body = { err: { code: '用户名已注册' } });
    }
    try {
      await ctx.model.User.create({
        username: req.body.username,
        password: req.body.password,
      });
      ctx.body = { data: 'sccess' };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 登陆
  async postLogin(ctx) {
    const { request: req, response: res } = ctx;

    try {
      const users = await ctx.model.User.find({
        username: req.body.username,
        password: req.body.password,
      });
      if (users.length > 0) {
        ctx.body = { data: req.body.username };
      } else {
        ctx.body = { err: { code: '用户名或密码错误' } };
      }
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 记录列表
  async getRecordList(ctx) {
    const { request: req, response: res } = ctx;
    try {
      const records = await ctx.model.Record.find();
      ctx.body = { data: records };
    } catch (err) {
      ctx.body = { data: '暂无记录' };
    }
  }
  // 删除记录数据
  async postRecordDelete(ctx) {
    const { request: req, response: res } = ctx;
    const result = await ctx.model.Record.deleteOne(req.body.item);
    if (result.deletedCount === 1) {
      ctx.body = { data: 'success' };
    } else {
      ctx.body = { err: { code: '删除失败' } };
    }
  }
  // 运行脚本到指定服务器
  async scriptRun(ctx) {
    const { request: req, response: res } = ctx;
    const targetHost = req.body.host;
    const targetScriptName = req.body.cmd;
    const env = req.headers.env;
    console.log("服务器名称：",targetHost, "脚本名称：",targetScriptName,"env:",env);
    // try {
    //   const hostsFilePath = path.resolve(req.context.hostsFile);
    //   const hostsData = await readFile(hostsFilePath, 'utf-8');
    //   console.log("服务器列表文件配置：", hostsData);
    // } catch (err) {
    //   console.error("读取服务器列表文件失败：", err);
    // }
    //
    // try {
    //   const scriptFilePath = path.resolve(req.context.scriptDir, targetScriptName);
    //   const scriptData = await readFile(scriptFilePath, 'utf-8');
    //   console.log("脚本文件内容：", scriptData);
    // } catch (err) {
    //   console.error("读取脚本文件失败：", err);
    // }

    let serverConfig = '';
    try {
      const hostsFilePath = path.resolve(req.context.hostsFile);
      const hostsData = await readFile(hostsFilePath, 'utf-8');
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
    const [host, password] = serverConfig.split(':');
    // 读取脚本文件的内容
    let scriptData;
    try {
      const scriptFilePath = path.resolve(req.context.scriptDir, targetScriptName);
      scriptData = await readFile(scriptFilePath, 'utf-8');
    } catch (err) {
      console.error("读取脚本文件失败：", err);
      ctx.body = { err: "脚本读取失败" };
      return;
    }

    // 构造服务器对象
    const server = {
      host: host,
      password: password,
    };
    const finalScript = utils.parseVars.call(scriptData);

    // 调用封装好的执行方法
    try {
      await ctx.service.executer.run(server, finalScript);
      ctx.body = { data: 'success' };
    } catch (err) {
      console.error("脚本执行失败：", err);
      ctx.body = { err: "脚本执行失败" };
    }

    ctx.body = { data: 'sccess' };
  }
}
module.exports = DeployController;
