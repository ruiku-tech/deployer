var express = require("express");
var router = express.Router();
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const bodyParser = require("body-parser");
const executer = require("./executer");

var multer = require("multer");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./files"); // 上传文件的存储路径
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

const fileDir = path.resolve(__dirname, "./files");

// 获取文件列表
router.get("/files", (req, res) => {
  fs.readdir(fileDir, (err, files) => {
    res.send({ err, data: files.map((file) => ({ file })) });
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
  list = executer.parse(list, req.body.files);
  const parseErrs = list.filter((item) => item.err);
  if (parseErrs.length) {
    return res.send({
      err: parseErrs.map((item) => item.name).join(","),
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
  executer.deployList(list);
});
router.post("/run", (req, res) => {
  executer
    .run(req.body.server, req.body.cmd)
    .then(() => {
      res.send({ data: "success" });
    })
    .catch((err) => {
      res.send({ err });
    });
});

module.exports = router;
