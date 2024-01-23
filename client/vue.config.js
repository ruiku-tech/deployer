const path = require('path');

module.exports = {
  // 设置publicPath以确保Vue应用正确地加载在Express.js服务器的子目录中
  publicPath: process.env.NODE_ENV === 'production' ? '/static/' : '/',
  // 将Vue应用构建输出到Express.js的静态文件目录中
  outputDir: path.resolve(__dirname, '../server/dist'),
  
  // 配置devServer，使其代理到Express.js服务器
  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // 这里是Express.js服务器的地址
        ws: true,
        changeOrigin: true
      }
    }
  }
};
