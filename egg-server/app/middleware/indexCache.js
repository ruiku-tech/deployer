module.exports = () => async (ctx, next) => {
  await next();
  if ((ctx.method === 'GET' || ctx.method === 'HEAD') && ctx.path === '/index.html') {
    ctx.set('cache-control', 'no-cache');
  }
};
