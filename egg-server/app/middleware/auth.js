module.exports = () => {
  return async function auth(ctx, next) {
    const authorizationHeader = ctx.header.authorization || ctx.header.Authorization;
    if (!authorizationHeader) {
      ctx.status = 401;
      ctx.body = { message: "请先登录" };
      return;
    }

    const token = authorizationHeader.replace(/^Bearer\s+/i, '');

    try {
      const decoded = ctx.app.jwt.verify(token, ctx.app.config.jwt.secret);
      const user = require('../service/access').user(decoded.username);
      if (!user || user.disabled) throw new Error('用户不可用');
      ctx.state.user = user;
      // Renew before expiry while the browser is using the platform. Always
      // verify the original signature/expiry and current user before renewing.
      const remaining = decoded.exp - Math.floor(Date.now() / 1000);
      if (remaining <= ctx.app.config.jwt.renewBeforeSeconds) {
        ctx.set('X-Access-Token', require('../service/session').issueToken(ctx.app, user.username));
        ctx.set('Cache-Control', 'no-store');
      }
    } catch (err) {
      ctx.status = 401;
      ctx.body = { message: "登录已过期或账号不可用，请重新登录" };
      return;
    }
    await next();
  };
};
