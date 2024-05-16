const { Controller } = require("egg");
const install = require("./install");
const path = require("path");
const fs = require("fs");
class envController extends Controller {
  // 获取环境列表
  async getList() {
    const { ctx } = this;
    const { request: req, response: res, body } = ctx;
    const workspaceDir = path.resolve(__dirname, "workspace");
    fs.readdir(workspaceDir, (err, files) => {
      body = { err, data: files.map((name) => ({ name })) };
    });
  }
  // 新建环境
  async postOne() {
    const { ctx } = this;
    const { request: req, response: res, body } = ctx;
    const name = req.body.name;
    const src = req.body.src;
    if (src) {
      // 复制环境
      install
        .copy(name, src)
        .then(() => {
          body = {};
        })
        .catch((err) => {
          body = { err };
        });
    } else {
      // 新建空环境
      install.create(name);
      body = {};
    }
  }
  // 删除配置
  async deleteOne() {
    const { ctx } = this;
    const { request: req, response: res, body } = ctx;
    const name = req.query.name;
    install
      .destory(name)
      .then(() => {
        body = {};
      })
      .catch((err) => {
        body = { err };
      });
  }
}

module.exports = envController;
