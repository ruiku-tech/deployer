# server



## QuickStart

<!-- add docs here for user -->

see [egg docs][egg] for more detail.

### Development

```bash
npm i
npm run dev
open http://localhost:7001/
```

### Deploy

```bash
npm start
npm stop
```

生产环境由 PM2 以单进程模式运行 Egg。平台收到管理员的更新请求后，会把更新任务提交给独立的一次性 PM2 进程 `deployer-updater`；更新进程停止 `deployer`、替换文件、安装依赖，再启动平台服务，因此更新不依赖旧服务进程继续存活。管理员请求成功表示任务已提交，不代表升级已经完成。可通过 `pm2 logs deployer-updater` 查看更新日志。服务器重启后需要自动恢复时，在服务器上执行一次 `pm2 startup` 和 `pm2 save`。平台不启用文件监控。

在 `egg-server` 目录执行 `npm run verify:self-update` 可验证更新流程。验证使用临时目录、独立的 `PM2_HOME` 和测试 HTTP 服务，运行项目的更新提交代码与升级脚本，实际执行 PM2 停服、解压及重启；GitHub、下载和依赖安装采用本地模拟。检查连续两次更新、重复请求拒绝和下载失败后旧服务继续运行。测试结束会关闭临时 PM2，日志目录打印在终端。验证需要本机允许启动进程、监听本地端口，并安装 `unzip`，不会对实际平台执行升级。

### npm scripts

- Use `npm run lint` to check code style.
- Use `npm test` to run unit test.

[egg]: https://eggjs.org
