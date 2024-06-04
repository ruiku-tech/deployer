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

    const context = config.createContext(env);
    if (!fs.existsSync(context.dir)) {
      return (ctx.body = { err: "当前环境不存在" });
    }
    req.context = context;
    await next();
  };
};
