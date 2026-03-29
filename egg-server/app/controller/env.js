const { Controller } = require('egg');
const install = require('../service/install');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { pipeline } = require('stream');
const pump = util.promisify(pipeline);

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

  // 导出环境配置
  async exportEnv() {
    const { ctx } = this;
    const name = ctx.query.name;

    if (!name) {
      ctx.status = 400;
      ctx.body = { err: '缺少环境名称' };
      return;
    }

    let archive;
    try {
      archive = install.exportEnv(name);
    } catch (err) {
      ctx.status = 500;
      ctx.body = { err: err.message || '导出失败' };
      return;
    }

    ctx.set('Content-Type', 'application/zip');
    ctx.set('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}_config.zip"`);
    ctx.status = 200;
    ctx.respond = false;

    archive.on('error', (err) => {
      console.error('Archive 错误:', err);
      if (!ctx.res.headersSent) {
        ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
      }
      ctx.res.end(JSON.stringify({ err: err.message }));
    });

    archive.on('end', () => {
      console.log(`环境 ${name} 导出完成，共 ${archive.pointer()} 字节`);
    });

    // 先 pipe，再 finalize（archiver 标准用法）
    archive.pipe(ctx.res);
    archive.finalize();
  }

  // 导入环境配置
  async importEnv() {
    const { ctx } = this;
    
    try {
      const stream = await ctx.getFileStream();
      const name = stream.fields.name;
      
      if (!name) {
        ctx.status = 400;
        ctx.body = { err: '缺少环境名称' };
        return;
      }

      // 保存上传的文件到临时目录
      const tempDir = path.resolve(__dirname, '../../workspace/temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFilePath = path.join(tempDir, `${name}_${Date.now()}.zip`);
      const writeStream = fs.createWriteStream(tempFilePath);
      
      await pump(stream, writeStream);
      
      // 导入环境
      await install.importEnv(name, tempFilePath);
      
      ctx.body = { data: '导入成功' };
    } catch (err) {
      ctx.status = 500;
      ctx.body = { err: err.err || err.message || '导入失败' };
    }
  }
}

module.exports = envController;
