var express = require("express");
var router = express.Router();
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const bodyParser = require("body-parser");
const executer = require("./executer");
const config = require("./config");

var multer = require("multer");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.resolve(__dirname, "files")); // 上传文件的存储路径
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

// {服务器名字:'host,password'}
// 获取变量
router.get("/vars", (req, res) => {
  const filePath = path.resolve(__dirname, "vars.ini");
  fs.readFile(filePath, "utf-8", (err, data) => {
    res.send({ err, data });
  });
});
// 获取配置
router.post("/vars", (req, res) => {
  const filePath = path.resolve(__dirname, "vars.ini");
  fs.writeFile(filePath, req.body.data, "utf-8", (err) => {
    res.send({ err });
  });
});

const fileDir = path.resolve(__dirname, "./files");

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
  fs.readdir(fileDir, (err, files) => {
    res.send({ err, data: files.map((file) => ({ file })) });
  });
});
router.get("/files-stat", (req, res) => {
  fs.readdir(fileDir, (err, files) => {
    Promise.all(
      files.map((file) => queryFileStat(path.resolve(fileDir, file)))
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
  const filePath = path.resolve(fileDir, name);
  fs.unlink(filePath, (err) => {
    res.send({ err });
  });
});

// {服务器名字:'host,password'}
// 获取服务器列表
router.get("/hosts", (req, res) => {
  const filePath = path.resolve(__dirname, "hosts.ini");
  fs.readFile(filePath, "utf-8", (err, data) => {
    res.send({ err, data: data ? JSON.parse(data) : {} });
  });
});
// 获取服务器列表
router.post("/hosts", (req, res) => {
  const filePath = path.resolve(__dirname, "hosts.ini");
  fs.writeFile(
    filePath,
    JSON.stringify(req.body.data, null, 2),
    "utf-8",
    (err) => {
      res.send({ err });
    }
  );
});

const configDir = path.resolve(__dirname, "./configs");
// 获取配置列表
router.get("/configs", (req, res) => {
  fs.readdir(configDir, (err, files) => {
    res.send({ err, data: files.map((name) => ({ name })) });
  });
});
// 获取配置
router.get("/config", (req, res) => {
  const name = req.query.name;
  const filePath = path.resolve(configDir, name);
  fs.readFile(filePath, "utf-8", (err, data) => {
    res.send({ err, data });
  });
});
// 上传配置
router.post("/config", (req, res) => {
  const name = req.body.name;
  const filePath = path.resolve(configDir, name);
  fs.writeFile(filePath, req.body.data, "utf-8", (err) => {
    res.send({ err });
  });
});
// 删除配置
router.delete("/config", (req, res) => {
  const name = req.query.name;
  const filePath = path.resolve(configDir, name);
  fs.unlink(filePath, (err) => {
    res.send({ err });
  });
});

const scriptDir = path.resolve(__dirname, "./scripts");
// 获取脚本列表
router.get("/scripts", (req, res) => {
  fs.readdir(scriptDir, (err, files) => {
    res.send({ err, data: files.map((name) => ({ name })) });
  });
});
// 获取脚本
router.get("/script", (req, res) => {
  const name = req.query.name;
  const filePath = path.resolve(scriptDir, name);
  fs.readFile(filePath, "utf-8", (err, data) => {
    res.send({ err, data });
  });
});
// 更新脚本
router.post("/script", (req, res) => {
  const name = req.body.name;
  const filePath = path.resolve(scriptDir, name);
  fs.writeFile(filePath, req.body.data, "utf-8", (err) => {
    res.send({ err });
  });
});
// 删除脚本
router.delete("/script", (req, res) => {
  const name = req.query.name;
  const filePath = path.resolve(scriptDir, name);
  fs.unlink(filePath, (err) => {
    res.send({ err });
  });
});

const batDir = path.resolve(__dirname, "./bats");
// 获取部署列表
router.get("/bats", (req, res) => {
  fs.readdir(batDir, (err, files) => {
    res.send({ err, data: files.map((name) => ({ name })) });
  });
});
// 获取部署
router.get("/bat", (req, res) => {
  const name = req.query.name;
  const filePath = path.resolve(batDir, name);
  fs.readFile(filePath, "utf-8", (err, data) => {
    res.send({ err, data });
  });
});
// 更新部署
router.post("/bat", (req, res) => {
  const name = req.body.name;
  const filePath = path.resolve(batDir, name);
  fs.writeFile(filePath, req.body.data, "utf-8", (err) => {
    res.send({ err });
  });
});
// 删除部署
router.delete("/bat", (req, res) => {
  const name = req.query.name;
  const filePath = path.resolve(batDir, name);
  fs.unlink(filePath, (err) => {
    res.send({ err });
  });
});
const deployDir = path.resolve(__dirname, "./deploys");
// 获取脚本列表
router.get("/deploys", (req, res) => {
  fs.readdir(
    deployDir,
    (err,
    (files) => {
      res.send({ err, data: files });
    })
  );
});

function parseVars() {
  const varStr = fs.readFileSync(config.varsFile, "utf-8");
  const lines = varStr.split("\n");
  return lines.reduce((ret, item) => {
    const arr = item.split(":");
    if (arr[0]) {
      ret[arr[0]] = arr[1].trim();
    }
    return ret;
  }, {});
}
function parseHosts() {
  const ret = JSON.parse(fs.readFileSync(config.hostsFile, "utf-8") || "{}");
  return Object.entries(ret).reduce((ret, item) => {
    const info = item[1].split(":");
    ret[item[0]] = { host: info[0], password: info[1] };
    return ret;
  }, {});
}

// 部署
router.post("/deploy", (req, res) => {
  const batNames = req.body.list;
  if (!batNames || !batNames.length) {
    return res.send({ err: "请选择部署的脚本" });
  }
  let list = batNames.map((name) => {
    const filePath = path.resolve(batDir, name);
    return { name, data: fs.readFileSync(filePath, "utf-8") };
  });
  const errBats = list.filter((item) => !item.data);
  if (errBats.length) {
    return res.send({
      err: `${errBats
        .map((item) => item.name)
        .join(",")}的脚本未找到，请先配置`,
    });
  }
  const vars = parseVars();
  const hosts = parseHosts();
  const context = { vars, hosts, files: req.body.files };
  list = executer.parse.call(context, list);
  const parseErrs = list.filter((item) => item.err);
  if (parseErrs.length) {
    return res.send({
      err: parseErrs.map((item) => item.err).join(","),
    });
  }
  // 记录部署记录
  fs.writeFile(
    path.resolve(deployDir, `${dayjs().format("YYYYMMDD-HH:mm:ss")}.txt`),
    JSON.stringify(list, null, 2),
    "utf-8",
    () => {}
  );
  res.send({ data: "success" });
  executer.deployList.call(context, list);
});
router.post("/run", (req, res) => {
  const hosts = parseHosts();
  const server = hosts[req.body.server];
  if (!server) {
    return res.send({ err: `找不到服务器:${req.body.server}` });
  }
  executer
    .run(server, req.body.cmd)
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

module.exports = router;
