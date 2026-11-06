const { Controller } = require('egg');
const install = require('../service/install');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { pipeline } = require('stream');
const pump = util.promisify(pipeline);
const disk = require('../service/disk');
const access = require('../service/access');

class envController extends Controller {
  // 获取环境列表
  async getList() {
    const { ctx } = this;
    const workspaceDir = access.workspace;
    try {
      const readdir = util.promisify(fs.readdir);
      const files = await readdir(workspaceDir, { withFileTypes: true });
      ctx.body = {
        data: files.filter(entry => entry.isDirectory() && access.canAccess(ctx.state.user.username, entry.name)).map(entry => {
          const team = access.init().prepare('SELECT e.team_id, t.name FROM environments e JOIN teams t ON t.id=e.team_id WHERE e.name=?').get(entry.name);
          return { name: entry.name, teamId: team?.team_id, teamName: team?.name || '' };
        }),
      };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 环境归属只能由管理员修改，每个环境始终只关联一个分组。
  async setTeam() {
    const { ctx } = this;
    access.assertAdmin(ctx);
    const { name, teamId } = ctx.request.body;
    ctx.assert(access.validEnv(name), 400, '环境名称无效');
    ctx.assert((typeof teamId === 'number' || typeof teamId === 'string') && Number.isSafeInteger(Number(teamId)) && Number(teamId) > 0, 400, '请选择一个有效分组');
    const db = access.init();
    db.transaction(() => {
      ctx.assert(db.prepare('SELECT name FROM environments WHERE name=?').get(name), 404, '环境不存在');
      ctx.assert(db.prepare('SELECT id FROM teams WHERE id=?').get(Number(teamId)), 404, '分组不存在');
      db.prepare('UPDATE environments SET team_id=? WHERE name=?').run(Number(teamId), name);
    })();
    ctx.body = { data: 'success' };
  }
  // 新建环境
  async postOne() {
    const { ctx } = this;
    const { request: req } = ctx;
    const name = req.body.name;
    const src = req.body.src;
    let teamId = Number(req.body.teamId);
    const workspace = access.workspace;
    if (!access.validEnv(name) || (src && !access.validEnv(src))) {
      ctx.throw(400, '环境名称无效');
    }
    if (src) access.assertEnv(ctx, src);
    if (!teamId && src) teamId = Number(access.init().prepare('SELECT team_id FROM environments WHERE name=?').get(src)?.team_id);
    if (!teamId) teamId = access.teams(ctx.state.user.username)[0]?.id;
    access.assertTeam(ctx, teamId);
    if (fs.existsSync(path.join(workspace, name))) ctx.throw(409, '环境已存在');
    let created = false;
    try {
      if (src) {
        const source = path.join(workspace, src);
        if (!fs.existsSync(source)) ctx.throw(404, '源环境不存在');
        await disk.requireSpace(workspace, await disk.directorySize(source));
        await install.copy(name, src);
        created = true;
        access.init().prepare('INSERT OR REPLACE INTO resource_notes(env,type,name,note) SELECT ?,type,name,note FROM resource_notes WHERE env=?').run(name, src);
      } else {
        install.create(name);
        created = true;
      }
      access.init().prepare('INSERT INTO environments(name,team_id) VALUES (?,?)').run(name, teamId);
      ctx.body = { data: 'success' };
    } catch (err) {
      if (created) await fs.promises.rm(path.join(workspace, name), { recursive: true, force: true }).catch(() => {});
      access.init().prepare('DELETE FROM environments WHERE name=?').run(name);
      ctx.status = err.status || (err.code === 'ENOSPC' ? 507 : 500);
      ctx.body = { message: err.message || err.err || '创建环境失败' };
    }
  }
  // 删除配置
  async deleteOne() {
    const { ctx } = this;
    const { request: req, response: res, body } = ctx;
    const name = req.query.name;
    access.assertEnv(ctx, name);
    await install
      .destory(name)
      .then(() => {
        access.init().prepare('DELETE FROM environments WHERE name=?').run(name);
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
    access.assertEnv(ctx, name);

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
    let tempFilePath;
    let imported = false;
    let name;
    try {
      const stream = await ctx.getFileStream();
      name = stream.fields.name;
      const teamId = Number(stream.fields.teamId);
      ctx.assert(access.validEnv(name), 400, '环境名称无效');
      access.assertTeam(ctx, teamId);
      ctx.assert(!fs.existsSync(path.join(access.workspace, name)), 409, '环境已存在');
      await disk.requireSpace(access.workspace, Number(ctx.request.length) || 0);
      
      if (!name) {
        ctx.status = 400;
        ctx.body = { err: '缺少环境名称' };
        return;
      }

      // 保存上传的文件到临时目录
      const tempDir = path.join(access.workspace, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      tempFilePath = path.join(tempDir, `${name}_${Date.now()}.zip`);
      const writeStream = fs.createWriteStream(tempFilePath);
      
      await pump(stream, writeStream);
      
      // 导入环境
      await install.importEnv(name, tempFilePath);
      imported = true;
      const notesPath = path.join(access.workspace, name, 'resource-notes.json');
      try {
        const notes = JSON.parse(await fs.promises.readFile(notesPath, 'utf8'));
        for (const row of notes) {
          if (['var', 'host', 'config', 'script', 'bat', 'bat-item'].includes(row.type) && typeof row.name === 'string') {
            require('../service/database').setNote(name, row.type, row.name, row.note);
          }
        }
        await fs.promises.unlink(notesPath);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
      access.init().prepare('INSERT INTO environments(name,team_id) VALUES (?,?)').run(name, teamId);
      
      ctx.body = { data: '导入成功' };
    } catch (err) {
      if (imported && name) {
        await fs.promises.rm(path.join(access.workspace, name), { recursive: true, force: true }).catch(() => {});
        access.init().prepare('DELETE FROM environments WHERE name=?').run(name);
      }
      ctx.status = err.status || (err.code === 'ENOSPC' ? 507 : 500);
      ctx.body = { err: err.err || err.message || '导入失败' };
    } finally {
      if (tempFilePath) await fs.promises.unlink(tempFilePath).catch(() => {});
    }
  }
}

module.exports = envController;
