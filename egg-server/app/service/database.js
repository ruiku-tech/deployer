/**
 * SQLite 数据库服务
 * 替代 MongoDB，使用本地轻量化数据库
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.resolve(__dirname, '../../data/deployer.db');

// 确保 data 目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  const d = getDb();

  // 用户表
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);

  // 部署记录表
  d.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cmds TEXT NOT NULL DEFAULT '[]',
      host TEXT NOT NULL,
      name TEXT NOT NULL,
      username TEXT NOT NULL,
      time INTEGER NOT NULL
    )
  `);
  d.exec('CREATE INDEX IF NOT EXISTS idx_records_time ON records(time DESC)');

  // 文件备注表
  d.exec(`
    CREATE TABLE IF NOT EXISTS file_memos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileName TEXT NOT NULL,
      memo TEXT DEFAULT '',
      uploadTime INTEGER DEFAULT (strftime('%s','now') * 1000)
    )
  `);

  // 脚本历史记录表
  d.exec(`
    CREATE TABLE IF NOT EXISTS script_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL UNIQUE,
      uploadTime INTEGER DEFAULT (strftime('%s','now') * 1000)
    )
  `);

  // 版本信息（用于迁移版本标记）
  d.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}

// ===== User 操作 =====

function findUsers(query = {}) {
  const d = getDb();
  const conditions = [];
  const params = [];
  for (const [ key, val ] of Object.entries(query)) {
    conditions.push(`${key} = ?`);
    params.push(val);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return d.prepare(`SELECT * FROM users ${where}`).all(...params);
}

function createUser({ username, password }) {
  const d = getDb();
  return d.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, password);
}

// ===== Record 操作 =====

function createRecord({ cmds, host, name, username, time }) {
  const d = getDb();
  const cmdsJson = JSON.stringify(cmds || []);
  const t = typeof time === 'number' ? time : new Date(time).getTime();
  return d.prepare(
    'INSERT INTO records (cmds, host, name, username, time) VALUES (?, ?, ?, ?, ?)'
  ).run(cmdsJson, host, name, username, t);
}

function createRecords(recordList) {
  const d = getDb();
  const insert = d.prepare(
    'INSERT INTO records (cmds, host, name, username, time) VALUES (?, ?, ?, ?, ?)'
  );
  const insertMany = d.transaction(records => {
    const results = [];
    for (const r of records) {
      const cmdsJson = JSON.stringify(r.cmds || []);
      const t = r.time ? (typeof r.time === 'number' ? r.time : new Date(r.time).getTime()) : Date.now();
      results.push(insert.run(cmdsJson, r.host, r.name, r.username, t));
    }
    return results;
  });
  return insertMany(recordList);
}

function findRecords({ page = 1, pageSize = 30 } = {}) {
  const d = getDb();
  const offset = (page - 1) * pageSize;
  const rows = d.prepare('SELECT * FROM records ORDER BY time DESC LIMIT ? OFFSET ?').all(pageSize, offset);
  // 解析 cmds JSON
  return rows.map(r => ({ ...r, cmds: JSON.parse(r.cmds) }));
}

function countRecords() {
  const d = getDb();
  return d.prepare('SELECT COUNT(*) as count FROM records').get().count;
}

function deleteRecord(item) {
  const d = getDb();
  if (item.id) {
    return d.prepare('DELETE FROM records WHERE id = ?').run(item.id);
  }
  // 兼容旧的按字段匹配删除
  const conditions = [];
  const params = [];
  for (const [ key, val ] of Object.entries(item)) {
    if (key === '_id') continue;
    if (key === 'cmds') {
      conditions.push('cmds = ?');
      params.push(JSON.stringify(val));
    } else if (key === 'time') {
      conditions.push('time = ?');
      params.push(typeof val === 'number' ? val : new Date(val).getTime());
    } else {
      conditions.push(`${key} = ?`);
      params.push(val);
    }
  }
  if (conditions.length === 0) return { changes: 0 };
  // 通过子查询来限制只删除一条
  return d.prepare(`DELETE FROM records WHERE rowid = (SELECT rowid FROM records WHERE ${conditions.join(' AND ')} LIMIT 1)`).run(...params);
}

// ===== FileMemo 操作 =====

function createFileMemo({ fileName, memo }) {
  const d = getDb();
  return d.prepare(
    'INSERT INTO file_memos (fileName, memo, uploadTime) VALUES (?, ?, ?)'
  ).run(fileName, memo || '', Date.now());
}

function findOneFileMemo(fileName) {
  const d = getDb();
  return d.prepare(
    'SELECT * FROM file_memos WHERE fileName = ? ORDER BY uploadTime DESC LIMIT 1'
  ).get(fileName);
}

// ===== ScriptRecord 操作 =====

function createScriptRecord({ text }) {
  const d = getDb();
  try {
    return d.prepare(
      'INSERT OR IGNORE INTO script_records (text, uploadTime) VALUES (?, ?)'
    ).run(text, Date.now());
  } catch (e) {
    // unique constraint - ignore
    return null;
  }
}

function findScriptRecords() {
  const d = getDb();
  return d.prepare('SELECT * FROM script_records ORDER BY uploadTime DESC').all();
}

function deleteScriptRecord(text) {
  const d = getDb();
  return d.prepare('DELETE FROM script_records WHERE text = ?').run(text);
}

// ===== Meta 操作 =====

function getMeta(key) {
  const d = getDb();
  const row = d.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setMeta(key, value) {
  const d = getDb();
  d.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value);
}

// ===== 迁移操作 =====

function getDbVersion() {
  return getMeta('db_version') || '0';
}

function setDbVersion(version) {
  setMeta('db_version', version);
}

function isMigrated() {
  return getMeta('migrated_from_mongo') === 'true';
}

function setMigrated() {
  setMeta('migrated_from_mongo', 'true');
}

// 批量导入迁移数据
function importMigrationData({ users = [], records = [], fileMemos = [], scriptRecords = [] }) {
  const d = getDb();

  const tx = d.transaction(() => {
    // 清空现有数据
    d.exec('DELETE FROM users');
    d.exec('DELETE FROM records');
    d.exec('DELETE FROM file_memos');
    d.exec('DELETE FROM script_records');

    // 导入用户
    const insertUser = d.prepare('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)');
    for (const u of users) {
      insertUser.run(u.username, u.password);
    }

    // 导入记录
    const insertRecord = d.prepare(
      'INSERT INTO records (cmds, host, name, username, time) VALUES (?, ?, ?, ?, ?)'
    );
    for (const r of records) {
      const cmds = Array.isArray(r.cmds) ? JSON.stringify(r.cmds) : r.cmds;
      const t = r.time ? new Date(r.time).getTime() : Date.now();
      insertRecord.run(cmds, r.host || '', r.name || '', r.username || '', t);
    }

    // 导入文件备注
    const insertMemo = d.prepare(
      'INSERT INTO file_memos (fileName, memo, uploadTime) VALUES (?, ?, ?)'
    );
    for (const m of fileMemos) {
      const t = m.uploadTime ? new Date(m.uploadTime).getTime() : Date.now();
      insertMemo.run(m.fileName, m.memo || '', t);
    }

    // 导入脚本历史
    const insertScript = d.prepare(
      'INSERT OR IGNORE INTO script_records (text, uploadTime) VALUES (?, ?)'
    );
    for (const s of scriptRecords) {
      const t = s.uploadTime ? new Date(s.uploadTime).getTime() : Date.now();
      insertScript.run(s.text, t);
    }

    setMigrated();
  });

  tx();
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDb,
  // User
  findUsers,
  createUser,
  // Record
  createRecord,
  createRecords,
  findRecords,
  countRecords,
  deleteRecord,
  // FileMemo
  createFileMemo,
  findOneFileMemo,
  // ScriptRecord
  createScriptRecord,
  findScriptRecords,
  deleteScriptRecord,
  // Meta
  getMeta,
  setMeta,
  getDbVersion,
  setDbVersion,
  isMigrated,
  setMigrated,
  importMigrationData,
  close,
  DB_PATH,
};
