module.exports = (options) => {
  return async (ctx, next) => {
    const { request: req, response: res } = ctx;
    if (!req.path.startsWith("/env") && !req.path.startsWith("/deployings")) {
      const env = req.headers.env;
      if (!env) {
        return ctx.body({ err: "请选择环境" });
      }
      const dir = path.resolve(__dirname, "workspace", env);

      const context = config.createContext(env);

      if (!fs.existsSync(context.dir)) {
        return ctx.body({ err: "当前环境不存在" });
      }
      req.context = context;
    }
    //解析
    ctx.app.middlewares.bodyParser(ctx, next);
    await next();
  };
};
