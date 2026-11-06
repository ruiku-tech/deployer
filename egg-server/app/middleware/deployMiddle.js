const path = require("path");
const fs = require("fs");
const config = require("../service/config");
module.exports = (options) => {
  return async (ctx, next) => {
    const { request: req, response: res } = ctx;
    const env = req.headers.env;

    if (!env) {
      return (ctx.body = { err: "请选择环境" });
    }
    require('../service/access').assertEnv(ctx, env);
    // 文件资源只能位于当前环境目录中。
    const checkName = value => {
      if (value !== undefined) ctx.assert(typeof value === 'string' && value.length > 0 && !/[\\/\0]/.test(value) && value !== '.' && value !== '..', 400, '资源名称无效');
    };
    checkName(req.query.name);
    checkName(req.body?.name);
    checkName(req.body?.filename);
    if (Array.isArray(req.body?.list)) for (const item of req.body.list) {
      ctx.assert(Array.isArray(item.cmds), 400, '脚本列表无效');
      item.cmds.forEach(checkName);
    }

    const context = config.createContext(env);
    if (!fs.existsSync(context.dir)) {
      return (ctx.body = { err: "当前环境不存在" });
    }
    req.context = context;
    await next();
  };
};
