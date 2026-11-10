class AppBootHook {
  constructor(app) {
    this.app = app;
    // 必须在 static 前执行，否则静态文件直接返回后应用中间件不会生效。
    app.config.coreMiddleware.unshift('indexCache');
  }
  async willReady() {
    // 进程退出时的执行结果无法判定，标记中断，防止重启重复发布。
    require('./app/service/releases').initSchedules()
      .prepare("UPDATE release_schedules SET status='interrupted',error='服务重启，执行已中断，请检查服务器后重新发布' WHERE status='running'")
      .run();
  }
}
module.exports = AppBootHook;
