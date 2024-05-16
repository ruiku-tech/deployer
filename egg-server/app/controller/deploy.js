const { Controller } = require("egg");
const dayjs = require("dayjs");
const cert = require("../service/cert");
const utils = require("../service/utils");
var multer = require("multer");
const { log } = require("console");
const { isObjectEqual } = require("../service/record");
const fs = require("fs");
const path = require("path");
const executer = require("../service/executer");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, req.context.fileDir); // 上传文件的存储路径
  },
  filename: function (req, file, cb) {
    const now = dayjs();
    const time = now.format("YYYYMMDD-HH:mm:ss");
    cb(null, `${time}~${file.originalname}`); // 上传文件的文件名
  },
});
const upload = multer({
  storage: storage,
});
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
    fs.writeFile(req.context.varsFile, req.body.data, "utf-8", (err) => {
      ctx.body = { err, data };
    });
  }

  // 更新配置
  async updateVars(ctx) {
    const { request: req, response: res } = ctx;
    fs.writeFile(req.context.varsFile, req.body.data, "utf-8", (err) => {
      ctx.body = { err };
    });
  }
  // 获取文件列表
  async getFiles(ctx) {
    const { request: req, response: res } = ctx;
    fs.readdir(req.context.fileDir, (err, files) => {
      ctx.body = { err, data: files.map((file) => ({ file })) };
    });
  }

  // 获取文件列表及文件大小
  async getFilesStat(ctx) {
    const { request: req, response: res } = ctx;
    fs.readdir(req.context.fileDir, (err, files) => {
      Promise.all(
        files.map((file) =>
          this.queryFileStat(path.resolve(req.context.fileDir, file))
        )
      ).then((list) => {
        ctx.body = {
          err,
          data: files.map((file, index) => ({ file, size: list[index] })),
        };
      });
    });
  }

  // 文件上传
  async uploadFile(ctx) {
    const { request: req, response: res } = ctx;
    const file = ctx.request.files[0];
    // 生成目标文件路径
    const targetPath = path.join(
      this.config.baseDir,
      "app/public/uploads",
      path.basename(file.filename)
    );
    // 确保目录存在
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    // 移动文件到目标路径
    await fs.promises.rename(file.filepath, targetPath);
    ctx.body = { data: "success" };
  }

  // 获取服务器列表
  async deleteFile(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const filePath = path.resolve(req.context.fileDir, name);
    fs.unlink(filePath, (err) => {
      ctx.body = { err };
    });
  }
  // {服务器名字:'host,password'}
  // 获取服务器列表
  async getHosts(ctx) {
    const { request: req, response: res } = ctx;
    fs.readFile(req.context.hostsFile, "utf-8", (err, data) => {
      ctx.body = { err, data: data ? JSON.parse(data) : {} };
    });
  }
  // 获取服务器列表
  async postHosts(ctx) {
    const { request: req, response: res } = ctx;
    console.log(req.context.hostsFile);
    fs.writeFile(
      req.context.hostsFile,
      JSON.stringify(req.body.data, null, 2),
      "utf-8",
      (err) => {
        ctx.body = { err };
      }
    );
  }

  // 获取配置列表
  async getConfigs(ctx) {
    const { request: req, response: res } = ctx;
    const context = req.context;
    fs.readdir(context.configDir, (err, files) => {
      ctx.body = { err, data: files.map((name) => ({ name })) };
    });
  }
  // 获取配置
  async getConfig(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.configDir, name);
    fs.readFile(filePath, "utf-8", (err, data) => {
      ctx.body = { err, data };
    });
  }
  // 上传配置
  async postConfig(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.body.name;
    const context = req.context;
    const filePath = path.resolve(context.configDir, name);
    fs.writeFile(filePath, req.body.data, "utf-8", (err) => {
      ctx.body = { err };
    });
  }
  // 删除配置
  async deleteConfig(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.configDir, name);
    fs.unlink(filePath, (err) => {
      ctx.body = { err };
    });
  }

  // 获取脚本列表
  async getScripts(ctx) {
    const { request: req, response: res } = ctx;
    const context = req.context;
    fs.readdir(context.scriptDir, (err, files) => {
      ctx.body = { err, data: files.map((name) => ({ name })) };
    });
  }
  // 获取脚本
  async getScript(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.scriptDir, name);
    fs.readFile(filePath, "utf-8", (err, data) => {
      ctx.body = { err, data };
    });
  }
  // 更新脚本
  async postScript(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.body.name;
    const context = req.context;
    const filePath = path.resolve(context.scriptDir, name);
    fs.writeFile(filePath, req.body.data, "utf-8", (err) => {
      ctx.body = { err };
    });
  }
  // 删除脚本
  async deleteScript(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.scriptDir, name);
    fs.unlink(filePath, (err) => {
      ctx.body = { err };
    });
  }

  // 获取编排列表
  async getBats(ctx) {
    const { request: req, response: res } = ctx;
    fs.readdir(req.context.batDir, (err, files) => {
      ctx.body = { err, data: files.map((name) => ({ name })) };
    });
  }
  // 获取编排
  async getbat(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const filePath = path.resolve(req.context.batDir, name);
    fs.readFile(filePath, "utf-8", (err, data) => {
      if (data) {
        ctx.body = { err, data: JSON.parse(data) };
      } else {
        ctx.body = { err: err || `编排组合[${name}]未找到` };
      }
    });
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
    fs.writeFile(filePath, "{}", "utf-8", (err) => {
      ctx.body = { err };
    });
  }
  // 删除编排
  async deleteBat(ctx) {
    const { request: req, response: res } = ctx;
    const context = req.context;
    const name = req.query.name;
    const filePath = path.resolve(context.batDir, name);
    fs.unlink(filePath, (err) => {
      ctx.body = { err };
    });
  }
  // 更新编排
  async postBatItem(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.body.name;
    const context = req.context;
    const filePath = path.resolve(context.batDir, name);
    fs.readFile(filePath, "utf-8", (err, data) => {
      const json = JSON.parse(data);
      const { name, ...rest } = req.body.data;
      json[name] = rest;
      fs.writeFile(filePath, JSON.stringify(json), "utf-8", (err) => {
        ctx.body = { err };
      });
    });
  }
  // 删除部署
  async deleteBatItem(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.batDir, name);
    fs.readFile(filePath, "utf-8", (err, data) => {
      const json = JSON.parse(data);
      delete json[req.query.item];
      fs.writeFile(filePath, JSON.stringify(json), "utf-8", (err) => {
        ctx.body = { err };
      });
    });
  }
  // 获取脚本列表
  async getDeploys(ctx) {
    const { request: req, response: res } = ctx;
    fs.readdir(
      req.context.deployDir,
      (err,
      (files) => {
        ctx.body = { err, data: files };
      })
    );
  }

  // 部署
  async postDeploy(ctx) {
    const { request: req, response: res } = ctx;
    // [{name:string,host:string,cmds:string[]}]
    let list = req.body.list;
    const env = req.body.env;
    const recordList = list;
    if (!list || !list.length) {
      return (ctx.body = { err: "请选择部署的脚本" });
    }
    const vars = utils.parseVars.call(req.context);
    const hosts = utils.parseHosts.call(req.context);
    const context = Object.assign(
      { vars, hosts, files: req.body.files },
      req.context
    );
    list = executer.parse.call(context, list);
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
    //     `${dayjs().format("YYYYMMDD-HH:mm:ss")}.txt`
    //   ),
    //   JSON.stringify(list, null, 2),
    //   "utf-8",
    //   () => {}
    // );
    let record = [];
    try {
      const data = fs.readFileSync(
        path.resolve(req.context.deployDir, `record.txt`),
        "utf8"
      );
      if (data) {
        record = JSON.parse(data);
      }
    } catch (err) {}
    record.push(...recordList);
    fs.writeFile(
      path.resolve(req.context.deployDir, `record.txt`),
      JSON.stringify(record, null, 2),
      "utf-8",
      () => {}
    );
    ctx.body = { data: "success" };
    executer.deployList.call(context, env, list);
  }
  async postRun(ctx) {
    const { request: req, response: res } = ctx;
    const hosts = utils.parseHosts.call(req.context);
    const server = hosts[req.body.server];
    if (!server) {
      return (ctx.body = { err: `找不到服务器:${req.body.server}` });
    }
    executer.run
      .call(req.context, server, req.body.cmd)
      .then(() => {
        ctx.body = { data: "success" };
      })
      .catch((err) => {
        ctx.body = { err };
      });
  }

  // 获取正在部署的
  async getDeployings(ctx) {
    const { request: req, response: res } = ctx;
    ctx.body = { data: executer.getDeployings() };
  }

  // 获取部署
  async deleteDeploying(ctx) {
    const { request: req, response: res } = ctx;
    const host = req.query.host;
    executer.stopDeploy(host);
    ctx.body = { data: "sccess" };
  }

  // 申请证书
  async postDeploySsl(ctx) {
    const { request: req, response: res } = ctx;
    const domain = req.body.domain;
    const context = req.context;
    const hosts = utils.parseHosts.call(req.context);
    const server = hosts[req.body.server];
    if (!server) {
      return (ctx.body = { err: `找不到服务器:${req.body.server}` });
    }
    cert.requestCertificate
      .call(context, server, domain)
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
      console.log({
        host: `${req.query.host}:${req.query.port}`,
        prefix: `${req.query.prefix}`,
      });
      const ApiTester = require("./api_test/index");
      global.isTest = false;
      new ApiTester({
        host: `${req.query.host}:${req.query.port}`,
        prefix: `${req.query.prefix}`,
      }).run();
    } catch (error) {
      console.log(error);
    }
    res.end();
  }

  // 注册
  async postRegister(ctx) {
    const { request: req, response: res } = ctx;
    // 检查文件是否存在
    if (!fs.existsSync(req.context.userFile)) {
      // 如果文件不存在，创建一个空文件
      fs.writeFileSync(req.context.userFile, "", "utf8");
    }
    // 读取文件
    fs.readFile(req.context.userFile, "utf8", (err, data) => {
      let jsonData;
      if (data) {
        try {
          jsonData = JSON.parse(data);
        } catch (parseError) {
          jsonData = [];
          return;
        }
      } else {
        jsonData = [];
      }
      const exist = jsonData.some(function (user) {
        return user.username === req.body.username;
      });
      if (exist) {
        return (ctx.body = { err: "用户名已注册" });
      }
      let userId;
      if (jsonData.length > 0) {
        userId = jsonData[jsonData.length - 1].userId + 1;
      } else {
        userId = 0;
      }
      jsonData.push({
        userId: userId,
        username: req.body.username,
        password: req.body.password,
      });
      fs.writeFile(
        req.context.userFile,
        JSON.stringify(jsonData, { recursive: true }, 2),
        "utf-8",
        (err) => {
          if (err) {
            ctx.body = { err };
          } else {
            ctx.body = { data: "sccess" };
          }
        }
      );
    });
  }
  // 登陆
  async postLogin(ctx) {
    const { request: req, response: res } = ctx;
    // 检查文件是否存在
    if (!fs.existsSync(req.context.userFile)) {
      // 如果文件不存在，创建一个空文件
      fs.writeFileSync(req.context.userFile, "", "utf8");
    }
    // 读取文件
    fs.readFile(req.context.userFile, "utf8", (err, data) => {
      let jsonData;
      if (data) {
        try {
          jsonData = JSON.parse(data);
        } catch (parseError) {
          jsonData = [];
          return;
        }
      } else {
        jsonData = [];
      }
      const exist = jsonData.find(function (account) {
        return (
          account.username === req.body.username &&
          account.password === req.body.password
        );
      });
      if (exist) {
        ctx.body = { data: req.body.username };
      } else {
        ctx.body = { err: { code: "用户名或密码错误" } };
      }
    });
  }
  // 记录列表
  async getRecordList(ctx) {
    const { request: req, response: res } = ctx;
    const userName = req.query.username;
    let recordList = [];
    try {
      const data = fs.readFileSync(
        path.resolve(req.context.deployDir, `record.txt`),
        "utf8"
      );
      if (data) {
        recordList = JSON.parse(data).filter(
          (record) => record.username === userName
        );
      }
    } catch (err) {}
    ctx.body = { data: recordList };
  }
  //删除记录数据
  async postRecordDelete(ctx) {
    const { request: req, response: res } = ctx;
    fs.readFile(
      path.resolve(req.context.deployDir, `record.txt`),
      "utf-8",
      (err, data) => {
        let json = JSON.parse(data);
        json = json.filter((item) => !isObjectEqual(item, req.body.item));
        fs.writeFile(
          path.resolve(req.context.deployDir, `record.txt`),
          JSON.stringify(json),
          "utf-8",
          (err) => {
            if (err) {
              ctx.body = { err };
            } else {
              ctx.body = { data: "success" };
            }
          }
        );
      }
    );
  }
}
module.exports = DeployController;
