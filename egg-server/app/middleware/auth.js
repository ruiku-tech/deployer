module.exports = () => {
  return async function auth(ctx, next) {
    const authorizationHeader = ctx.header.authorization || ctx.header.Authorization;
    if (!authorizationHeader) {
      ctx.status = 401;
      ctx.body = { message: "Authorization header is missing" };
      return;
    }

    const token = authorizationHeader;

    try {
      const decoded = ctx.app.jwt.verify(token, ctx.app.config.jwt.secret);
      ctx.state.user = decoded;
    } catch (err) {
      ctx.status = 401;
      ctx.body = { message: "Invalid or expired token" };
      return;
    }
    await next();
  };
};
