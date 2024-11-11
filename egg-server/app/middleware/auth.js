module.exports = () => {
  return async function auth(ctx, next) {
    const authorizationHeader = ctx.request.header.authorization;

    if (!authorizationHeader) {
      ctx.status = 401;
      ctx.body = { message: "Authorization header is missing" };
      return;
    }

    const token = ctx.request.header.authorization;

    try {
      const decoded = ctx.app.jwt.verify(token, ctx.app.config.jwt.secret);

      ctx.state.user = decoded;
      await next();
    } catch (err) {
      ctx.status = 401;
      ctx.body = { message: "Invalid or expired token" };
    }
  };
};
