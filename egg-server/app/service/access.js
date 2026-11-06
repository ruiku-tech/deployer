const fs = require('fs');
const path = require('path');
const database = require('./database');
const workspace = require('./config').workspace;
let initializedDb;

function init() {
  const db = database.getDb();
  if (initializedDb === db && (database.getMeta('teams_migrated') || !db.prepare('SELECT id FROM users LIMIT 1').get())) return db;
  db.transaction(() => {
    const columns = db.prepare('PRAGMA table_info(users)').all().map(x => x.name);
    if (!columns.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
    if (!columns.includes('disabled')) db.exec('ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0');
    db.exec(`CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL,
      telegram_token TEXT NOT NULL DEFAULT '', telegram_chat TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY(team_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS environments (
      name TEXT PRIMARY KEY, team_id INTEGER NOT NULL REFERENCES teams(id)
    );`);
    db.prepare("INSERT OR IGNORE INTO teams(name) VALUES ('默认分组')").run();
    // 仅对升级前的成员和环境执行一次自动归组。
    if (!database.getMeta('teams_migrated') && db.prepare('SELECT id FROM users LIMIT 1').get()) {
      const team = db.prepare("SELECT id FROM teams WHERE name='默认分组'").get().id;
      db.prepare("UPDATE users SET role='superadmin' WHERE id=(SELECT MIN(id) FROM users)").run();
      db.prepare('INSERT OR IGNORE INTO team_members SELECT ?,id FROM users').run(team);
      if (fs.existsSync(workspace)) {
        for (const entry of fs.readdirSync(workspace, { withFileTypes: true })) {
          if (entry.isDirectory() && validEnv(entry.name)) db.prepare('INSERT OR IGNORE INTO environments VALUES (?,?)').run(entry.name, team);
        }
      }
      database.setMeta('teams_migrated', '1');
    }
  })();
  initializedDb = db;
  return db;
}
function validEnv(name) { return typeof name === 'string' && /^[a-zA-Z0-9_-]+$/.test(name) && !['user', 'temp'].includes(name); }
function user(username) { return init().prepare('SELECT id,username,role,disabled FROM users WHERE username=?').get(username); }
function canAccess(username, env) {
  const current = user(username);
  if (!current || current.disabled || !validEnv(env)) return false;
  if (current.role === 'superadmin') return true;
  return !!init().prepare('SELECT 1 FROM environments e JOIN team_members m ON e.team_id=m.team_id WHERE e.name=? AND m.user_id=?').get(env, current.id);
}
function assertEnv(ctx, env) { ctx.assert(validEnv(env), 400, '环境名称无效'); ctx.assert(canAccess(ctx.state.user.username, env), 403, '无权访问此环境'); }
function assertAdmin(ctx) { ctx.assert(user(ctx.state.user.username)?.role === 'superadmin', 403, '仅超级管理员可以操作'); }
function teams(username) {
  const current = user(username);
  if (!current || current.disabled) return [];
  const rows = current.role === 'superadmin' ? init().prepare('SELECT * FROM teams ORDER BY id').all() : init().prepare('SELECT t.* FROM teams t JOIN team_members m ON m.team_id=t.id WHERE m.user_id=? ORDER BY t.id').all(current.id);
  return rows.map(({ telegram_token, ...team }) => ({ ...team, telegramConfigured: !!(telegram_token && team.telegram_chat), members: init().prepare('SELECT user_id FROM team_members WHERE team_id=?').all(team.id).map(x => x.user_id) }));
}
function assertTeam(ctx, id) { ctx.assert(teams(ctx.state.user.username).some(x => x.id === Number(id)), 403, '无权使用此分组'); }
function register(username, password) {
  const db = init();
  const result = db.transaction(() => {
    const first = !db.prepare('SELECT id FROM users LIMIT 1').get();
    const result = db.prepare('INSERT INTO users(username,password,role) VALUES(?,?,?)').run(username, password, first ? 'superadmin' : 'member');
    return result;
  })();
  const userId = Number(result.lastInsertRowid);
  if (user(username).role === 'superadmin') {
    const teamId = db.prepare("SELECT id FROM teams WHERE name='默认分组'").get().id;
    db.prepare('INSERT OR IGNORE INTO team_members(team_id,user_id) VALUES(?,?)').run(teamId, userId);
    database.setMeta('teams_migrated', '1');
    initializedDb = null;
    init();
  }
  return result;
}
module.exports = { init, user, validEnv, canAccess, assertEnv, assertAdmin, assertTeam, teams, register, workspace };
