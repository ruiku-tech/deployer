const { Service } = require('egg');
const database = require('./database');
const access = require('./access');
const config = require('./config');
const utils = require('./utils');

function init() {
  const db = access.init();
  db.exec(`CREATE TABLE IF NOT EXISTS release_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT, env TEXT NOT NULL, payload TEXT NOT NULL,
    run_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    created_by TEXT NOT NULL, created_at INTEGER NOT NULL, error TEXT NOT NULL DEFAULT ''
  )`);
  return db;
}
class Releases extends Service {
  prepare(env, payload) {
    if (!Array.isArray(payload.list) || !payload.list.length) throw new Error('请选择部署的脚本');
    for (const item of payload.list) {
      if (!Array.isArray(item.cmds) || !item.cmds.length || item.cmds.some(name => typeof name !== 'string' || /[\\/\0]/.test(name) || ['.', '..'].includes(name))) throw new Error('脚本名称无效');
    }
    const context = config.createContext(env);
    const files = payload.files || {};
    for (const name of Object.values(files)) {
      if (typeof name !== 'string' || /[\\/\0]/.test(name) || ['.', '..'].includes(name)) throw new Error('部署文件无效');
    }
    const parsed = this.ctx.service.executer.parse(env, { ...context, vars: utils.parseVars.call(context), hosts: utils.parseHosts.call(context), files }, payload.list);
    const errors = parsed.filter(x => x.err);
    if (errors.length) throw new Error(errors.map(x => x.err).join('，'));
    return parsed;
  }
  async notify(env, text) {
    const team = access.init().prepare('SELECT t.* FROM teams t JOIN environments e ON e.team_id=t.id WHERE e.name=?').get(env);
    if (!team?.telegram_token || !team.telegram_chat) return;
    try {
      await require('axios').post(`https://api.telegram.org/bot${team.telegram_token}/sendMessage`, { chat_id: team.telegram_chat, text }, { timeout: 5000 });
    } catch (err) { this.ctx.logger.warn('Telegram 通知发送失败，环境：%s', env); }
  }
  async execute(env, payload, username, scheduled = false) {
    if (!access.canAccess(username, env)) throw new Error('创建者已无权访问此环境');
    const list = this.prepare(env, payload);
    database.createRecords(payload.list.map(item => ({ ...item, username })), env);
    await this.notify(env, `${scheduled ? '定时发布开始' : '发布开始'}\n环境：${env}\n操作人：${username}\n部署项：${payload.list.map(x => x.name || x.host).join('、')}`);
    await this.ctx.service.executer.deployList(list);
  }
  async create(env, payload, username, runAt) {
    this.prepare(env, payload);
    if (!Number.isFinite(runAt) || runAt <= Date.now()) throw new Error('请选择未来的发布时间');
    const result = init().prepare('INSERT INTO release_schedules(env,payload,run_at,created_by,created_at) VALUES(?,?,?,?,?)').run(env, JSON.stringify(payload), runAt, username, Date.now());
    await this.notify(env, `定时发布已开启\n环境：${env}\n操作人：${username}\n时间：${new Date(runAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}（北京时间）`);
    return Number(result.lastInsertRowid);
  }
  async tick() {
    const db = init();
    const pending = db.prepare("SELECT * FROM release_schedules WHERE status='pending' AND run_at<=? ORDER BY run_at LIMIT 20").all(Date.now());
    for (const task of pending) {
      if (!db.prepare("UPDATE release_schedules SET status='running' WHERE id=? AND status='pending'").run(task.id).changes) continue;
      try {
        // 每个任务使用独立上下文，避免执行器的环境与变量相互覆盖。
        const ctx = this.app.createAnonymousContext();
        await ctx.service.releases.execute(task.env, JSON.parse(task.payload), task.created_by, true);
        db.prepare("UPDATE release_schedules SET status='success' WHERE id=?").run(task.id);
      } catch (err) {
        db.prepare("UPDATE release_schedules SET status='failed',error=? WHERE id=?").run(err.message || '发布失败', task.id);
      }
    }
  }
}
module.exports = Releases;
module.exports.initSchedules = init;
