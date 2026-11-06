const { Controller } = require('egg');
const access = require('../service/access');
const { initSchedules } = require('../service/releases');
class Schedule extends Controller {
  async list() {
    const { ctx } = this;
    ctx.body = { data: initSchedules().prepare('SELECT * FROM release_schedules ORDER BY run_at DESC LIMIT 500').all().filter(x => access.canAccess(ctx.state.user.username, x.env)).map(({ payload, ...task }) => ({ ...task, items: JSON.parse(payload).list.map(x => x.name || x.host).join('、') })) };
  }
  async cancel() {
    const { ctx } = this;
    const db = initSchedules();
    const task = db.prepare('SELECT * FROM release_schedules WHERE id=?').get(Number(ctx.request.body.id));
    ctx.assert(task, 404, '任务不存在');
    access.assertEnv(ctx, task.env);
    ctx.assert(db.prepare("UPDATE release_schedules SET status='cancelled' WHERE id=? AND status='pending'").run(task.id).changes, 409, '仅待执行的任务可以取消');
    ctx.body = { data: 'success' };
  }
}
module.exports = Schedule;
