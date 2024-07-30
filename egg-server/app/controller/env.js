const { Controller } = require('egg');
const install = require('../service/install');
const path = require('path');
const fs = require('fs');
const util = require('util');
class envController extends Controller {
  // 获取环境列表
  async getList() {
    const { ctx } = this;
    const workspaceDir = path.resolve(__dirname, '../../workspace');
    try {
      const readdir = util.promisify(fs.readdir);
      const files = await readdir(workspaceDir);
      ctx.body = {
        data: files.filter(name => name !== 'user').map(name => ({ name })),
      };
    } catch (err) {
      ctx.body = { err };
    }
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
        .catch(err => {
          body = { err };
        });
    } else {
      // 新建空环境
      install.create(name);
      ctx.body = {};
    }
  }
  // 删除配置
  async deleteOne() {
    const { ctx } = this;
    const { request: req, response: res, body } = ctx;
    const name = req.query.name;
    await install
      .destory(name)
      .then(() => {
        ctx.body = {};
      })
      .catch(err => {
        ctx.body = { err };
      });
  }
}

module.exports = envController;
