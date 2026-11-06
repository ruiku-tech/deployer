const { Controller } = require('egg');
const access = require('../service/access');

class TeamController extends Controller {
  async me() { this.ctx.body = { data: access.user(this.ctx.state.user.username) }; }
  async list() { this.ctx.body = { data: access.teams(this.ctx.state.user.username) }; }
  async users() { access.assertAdmin(this.ctx); this.ctx.body = { data: access.init().prepare('SELECT id,username,role,disabled FROM users ORDER BY id').all() }; }
  async save() {
    const { ctx } = this;
    access.assertAdmin(ctx);
    const { id, name, members, telegramToken, telegramChat } = ctx.request.body;
    ctx.assert(typeof name === 'string' && name.trim(), 400, '请输入分组名称');
    ctx.assert(Array.isArray(members), 400, '成员列表无效');
    const db = access.init();
    const savedId = db.transaction(() => {
      let teamId = Number(id);
      if (teamId) {
        ctx.assert(db.prepare('SELECT id FROM teams WHERE id=?').get(teamId), 404, '分组不存在');
        db.prepare('UPDATE teams SET name=?,telegram_chat=? WHERE id=?').run(name.trim(), telegramChat || '', teamId);
        if (telegramToken) db.prepare('UPDATE teams SET telegram_token=? WHERE id=?').run(telegramToken, teamId);
      } else {
        teamId = Number(db.prepare('INSERT INTO teams(name,telegram_token,telegram_chat) VALUES(?,?,?)').run(name.trim(), telegramToken || '', telegramChat || '').lastInsertRowid);
      }
      db.prepare('DELETE FROM team_members WHERE team_id=?').run(teamId);
      const insert = db.prepare('INSERT INTO team_members(team_id,user_id) VALUES(?,?)');
      for (const member of [...new Set(members.map(Number))]) insert.run(teamId, member);
      return teamId;
    })();
    ctx.body = { data: savedId };
  }
  async setUser() {
    const { ctx } = this;
    access.assertAdmin(ctx);
    const id = Number(ctx.request.body.id);
    const target = access.init().prepare('SELECT * FROM users WHERE id=?').get(id);
    ctx.assert(target && target.role !== 'superadmin', 400, '不能修改超级管理员');
    access.init().prepare('UPDATE users SET disabled=? WHERE id=?').run(ctx.request.body.disabled ? 1 : 0, id);
    ctx.body = { data: 'success' };
  }
}
module.exports = TeamController;
