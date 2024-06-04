var express = require("express");
var router = express.Router();
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const bodyParser = require("body-parser");
const executer = require("./executer");
const envRouter = require("./env.router");
const cert = require("./cert");
const utils = require("./utils");
const apiAuto = require("./api/index");
const broadcast = require("./broadcast");
var multer = require("multer");
const { log } = require("console");
const { isObjectEqual } = require("./record");
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
router.use(bodyParser.json());

router.use("/env", envRouter);
// {服务器名字:'host,password'}
// 获取变量
router.get("/vars", (req, res) => {
  fs.readFile(req.context.varsFile, "utf-8", (err, data) => {
    res.send({ err, data });
  });
});
// 获取配置
router.post("/vars", (req, res) => {
  fs.writeFile(req.context.varsFile, req.body.data, "utf-8", (err) => {
    res.send({ err });
  });
});

function queryFileStat(filePath) {
  return new Promise((rs, rj) => {
    fs.stat(filePath, (err, stat) => {
      if (err) {
        return rs(`err:${err.code}`);
      }
      rs(`${(stat.size / 1000000).toFixed(3)}M(${stat.size})`);
    });
  });
}
// 获取文件列表
router.get("/files", (req, res) => {
  fs.readdir(req.context.fileDir, (err, files) => {
    res.send({ err, data: files.map((file) => ({ file })) });
  });
});
router.get("/files-stat", (req, res) => {
  fs.readdir(req.context.fileDir, (err, files) => {
    Promise.all(
      files.map((file) =>
        queryFileStat(path.resolve(req.context.fileDir, file))
      )
    ).then((list) => {
      res.send({
        err,
        data: files.map((file, index) => ({ file, size: list[index] })),
      });
    });
  });
});
// 文件上传
router.post("/file", upload.single("file"), function (req, res, next) {
  res.send({ data: "success" });
});
// 获取服务器列表
router.delete("/file", (req, res) => {
  const name = req.query.name;
  const filePath = path.resolve(req.context.fileDir, name);
  fs.unlink(filePath, (err) => {
    res.send({ err });
  });
});

// {服务器名字:'host,password'}
// 获取服务器列表
router.get("/hosts", (req, res) => {
  fs.readFile(req.context.hostsFile, "utf-8", (err, data) => {
    res.send({ err, data: data ? JSON.parse(data) : {} });
  });
});
// 获取服务器列表
router.post("/hosts", (req, res) => {
  console.log(req.context.hostsFile);
  fs.writeFile(
    req.context.hostsFile,
    JSON.stringify(req.body.data, null, 2),
    "utf-8",
    (err) => {
      res.send({ err });
    }
  );
});

// 获取配置列表
router.get("/configs", (req, res) => {
  const context = req.context;
  fs.readdir(context.configDir, (err, files) => {
    res.send({ err, data: files.map((name) => ({ name })) });
  });
});
// 获取配置
router.get("/config", (req, res) => {
  const name = req.query.name;
  const context = req.context;
  const filePath = path.resolve(context.configDir, name);
  fs.readFile(filePath, "utf-8", (err, data) => {
    res.send({ err, data });
  });
});
// 上传配置
router.post("/config", (req, res) => {
  const name = req.body.name;
  const context = req.context;
  const filePath = path.resolve(context.configDir, name);
  fs.writeFile(filePath, req.body.data, "utf-8", (err) => {
    res.send({ err });
  });
});
// 删除配置
router.delete("/config", (req, res) => {
  const name = req.query.name;
  const context = req.context;
  const filePath = path.resolve(context.configDir, name);
  fs.unlink(filePath, (err) => {
    res.send({ err });
  });
});

// 获取脚本列表
router.get("/scripts", (req, res) => {
  const context = req.context;
  fs.readdir(context.scriptDir, (err, files) => {
    res.send({ err, data: files.map((name) => ({ name })) });
  });
});
// 获取脚本
router.get("/script", (req, res) => {
  const name = req.query.name;
  const context = req.context;
  const filePath = path.resolve(context.scriptDir, name);
  fs.readFile(filePath, "utf-8", (err, data) => {
    res.send({ err, data });
  });
});
// 更新脚本
router.post("/script", (req, res) => {
  const name = req.body.name;
  const context = req.context;
  const filePath = path.resolve(context.scriptDir, name);
  fs.writeFile(filePath, req.body.data, "utf-8", (err) => {
    res.send({ err });
  });
});
// 删除脚本
router.delete("/script", (req, res) => {
  const name = req.query.name;
  const context = req.context;
  const filePath = path.resolve(context.scriptDir, name);
  fs.unlink(filePath, (err) => {
    res.send({ err });
  });
});

// 获取编排列表
router.get("/bats", (req, res) => {
  fs.readdir(req.context.batDir, (err, files) => {
    res.send({ err, data: files.map((name) => ({ name })) });
  });
});
// 获取编排
router.get("/bat", (req, res) => {
  const name = req.query.name;
  const filePath = path.resolve(req.context.batDir, name);
  fs.readFile(filePath, "utf-8", (err, data) => {
    if (data) {
      res.send({ err, data: JSON.parse(data) });
    } else {
      res.send({ err: err || `编排组合[${name}]未找到` });
    }
  });
});
// 新增编排
router.post("/bat", (req, res) => {
  const name = req.body.name;
  const context = req.context;
  const filePath = path.resolve(context.batDir, name);
  const exist = fs.existsSync(filePath);
  if (exist) {
    return res.send({ err: "编排已存在" });
  }
  fs.writeFile(filePath, "{}", "utf-8", (err) => {
    res.send({ err });
  });
});
// 删除编排
router.delete("/bat", (req, res) => {
  const context = req.context;
  const name = req.query.name;
  const filePath = path.resolve(context.batDir, name);
  fs.unlink(filePath, (err) => {
    res.send({ err });
  });
});
// 更新编排
router.post("/bat-item", (req, res) => {
  const name = req.body.name;
  const context = req.context;
  const filePath = path.resolve(context.batDir, name);
  fs.readFile(filePath, "utf-8", (err, data) => {
    const json = JSON.parse(data);
    const { name, ...rest } = req.body.data;
    json[name] = rest;
    fs.writeFile(filePath, JSON.stringify(json), "utf-8", (err) => {
      res.send({ err });
    });
  });
});
// 删除部署
router.delete("/bat-item", (req, res) => {
  const name = req.query.name;
  const context = req.context;
  const filePath = path.resolve(context.batDir, name);
  fs.readFile(filePath, "utf-8", (err, data) => {
    const json = JSON.parse(data);
    delete json[req.query.item];
    fs.writeFile(filePath, JSON.stringify(json), "utf-8", (err) => {
      res.send({ err });
    });
  });
});
// 获取脚本列表
router.get("/deploys", (req, res) => {
  fs.readdir(
    req.context.deployDir,
    (err,
    (files) => {
      res.send({ err, data: files });
    })
  );
});

// 部署
router.post("/deploy", (req, res) => {
  // [{name:string,host:string,cmds:string[]}]
  let list = req.body.list;
  const env = req.body.env;
  const recordList = list;
  if (!list || !list.length) {
    return res.send({ err: "请选择部署的脚本" });
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
    return res.send({
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
  executer.deployList.call(context, list);
  res.send({ data: "success" });
});
router.post("/run", (req, res) => {
  const hosts = utils.parseHosts.call(req.context);
  const server = hosts[req.body.server];
  if (!server) {
    return res.send({ err: `找不到服务器:${req.body.server}` });
  }
  const vars = utils.parseVars.call(req.context);
  const context = Object.assign(
    { vars, hosts, files: req.body.files,server },
    req.context
  );
  const ret = executer.resolveExpress.call(context,req.body.cmd,{})
  if(ret.err){
    return res.send({ err: ret.err });
  }
  executer.run
    .call(req.context, server, ret.data)
    .then(() => {
      res.send({ data: "success" });
    })
    .catch((err) => {
      res.send({ err });
    });
});

// 获取正在部署的
router.get("/deployings", (req, res) => {
  res.send({ data: executer.getDeployings() });
});

// 获取部署
router.delete("/deploying", (req, res) => {
  const host = req.query.host;
  executer.stopDeploy(host);
  res.send({ data: "sccess" });
});

// 申请证书
router.post("/deploy-ssl", (req, res) => {
  const domain = req.body.domain;
  const context = req.context;
  const hosts = utils.parseHosts.call(req.context);
  const server = hosts[req.body.server];
  if (!server) {
    return res.send({ err: `找不到服务器:${req.body.server}` });
  }
  cert.requestCertificate
    .call(context, server, domain)
    .then(() => {
      res.send({ data: "sccess" });
    })
    .catch((err) => {
      res.send({ err });
    });
});

router.get("/api_auto", (req, res) => {
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
});

// 注册
router.post("/register", (req, res) => {
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
      return res.send({ err: "用户名已注册" });
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
          res.send({ err });
        } else {
          res.send({ data: "sccess" });
        }
      }
    );
  });
});
// 登陆
router.post("/login", (req, res) => {
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
      res.send({ data: req.body.username });
    } else {
      res.send({ err: { code: "用户名或密码错误" } });
    }
  });
});
// 记录列表
router.get("/recordList", (req, res) => {
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
  res.send({ data: recordList });
});
//删除记录数据
router.post("/recordDelete", (req, res) => {
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
            res.send({ err });
          } else {
            res.send({ data: "success" });
          }
        }
      );
    }
  );
});
module.exports = router;
