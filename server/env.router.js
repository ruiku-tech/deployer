var express = require("express");
var router = express.Router();
const install = require("./install");
const path = require("path");
const fs = require("fs");

// 获取环境列表
router.get("/list", (req, res) => {
  const workspaceDir = path.resolve(__dirname, "workspace");
  fs.readdir(workspaceDir, (err, files) => {
    res.send({ err, data: files.map((name) => ({ name })) });
  });
});
// 新建环境
router.post("/one", (req, res) => {
  const name = req.body.name;
  const src = req.body.src;
  if (src) {
    // 复制环境
    install
      .copy(name, src)
      .then(() => {
        res.send({});
      })
      .catch((err) => {
        res.send({ err });
      });
  } else {
    // 新建空环境
    install.create(name);
    res.send({});
  }
});
// 删除配置
router.delete("/one", (req, res) => {
  const name = req.query.name;
  install
    .destory(name)
    .then(() => {
      res.send({});
    })
    .catch((err) => {
      res.send({ err });
    });
});

module.exports = router;
