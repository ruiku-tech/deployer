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
npm install -g pm2@5
npm install --omit=dev
npm start
npm stop
```

PM2 由服务器全局安装，项目的生产依赖不包含 PM2。平台启动和更新都从 `PATH` 查找全局 `pm2`，跳过项目 `node_modules` 中的命令；使用 nvm 或守护进程的 PATH 不完整时，可设置 `DEPLOY_PM2_BIN=/绝对路径/bin/pm2`。必须使用同一系统用户和相同的 `PM2_HOME` 操作，才能管理同一个 PM2 守护进程。普通版本更新只安装项目依赖，不安装或更新全局 PM2。若更换了全局 PM2 主版本，先检查 `pm2 status` 是否提示 in-memory daemon 版本过旧，再执行一次 `pm2 update` 同步 daemon。

更新失败时先查看 `tail -n 100 /tmp/deployer-upgrade.log` 和 `pm2 logs deployer --lines 60 --nostream`。确认项目文件已完整解压、依赖安装成功后，可在项目目录用全局 `pm2 startOrRestart ecosystem.config.js --only deployer` 恢复服务；这条命令也适用于仍引用本地 PM2 的旧启动脚本。不要在更新进程仍运行时同时手动恢复。

从项目内置 PM2 的旧版本首次迁移到全局 PM2 时，请手动部署本版。旧更新进程在启动时已经保存了 `node_modules/.bin/pm2` 路径，而安装新依赖会清理本地 PM2，导致它无法执行最后的启动命令。确认没有更新任务运行后，使用管理该平台的同一系统用户依次执行（先将新发布包上传到 `/tmp/release.zip`）：

```bash
cd /usr/egg-server
pm2 delete deployer
unzip -o /tmp/release.zip -d /usr/egg-server
npm install --omit=dev
pm2 startOrRestart ecosystem.config.js --only deployer
```

每一步成功后再继续下一步；安装失败时先排除错误，不要继续启动。本次迁移完成后的更新使用全局 PM2，不再依赖会随项目安装被删除的本地命令。

生产环境由 PM2 以单进程模式运行 Egg。平台收到管理员的更新请求后，会把更新任务提交给独立的一次性 PM2 进程 `deployer-updater`；更新进程停止 `deployer`、替换文件、安装依赖，再启动平台服务，因此更新不依赖旧服务进程继续存活。管理员请求成功表示任务已提交，不代表升级已经完成。可通过 `pm2 logs deployer-updater` 查看更新日志。服务器重启后需要自动恢复时，在服务器上执行一次 `pm2 startup` 和 `pm2 save`。平台不启用文件监控。

在 `egg-server` 目录执行 `npm run verify:self-update` 可验证更新流程。验证使用临时目录、独立的 `PM2_HOME` 和测试 HTTP 服务，运行项目的更新提交代码与升级脚本，实际执行 PM2 停服、解压及重启；GitHub、下载和依赖安装采用本地模拟。检查连续两次更新、重复请求拒绝和下载失败后旧服务继续运行。测试结束会关闭临时 PM2，日志目录打印在终端。验证需要本机允许启动进程、监听本地端口，并安装 `unzip`，不会对实际平台执行升级。

### npm scripts

- Use `npm run lint` to check code style.
- Use `npm test` to run unit test.

[egg]: https://eggjs.org
