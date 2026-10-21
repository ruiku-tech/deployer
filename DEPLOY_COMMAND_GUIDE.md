# 部署命令编写规则文档

本文档详细说明部署系统支持的所有命令指令及其使用方法，方便为其他项目自动生成部署脚本。

---

## 一、命令结构概述

部署脚本由**多行命令**组成，每行一条指令。系统按顺序执行，支持动态替换、文件传输、远程执行等操作。

**基本格式：**
```
<命令前缀>: <命令内容>
```

**重要限制：**
- ⚠️ **每条命令必须写在一行**，不支持 Shell 的 `\` 续行符
- 系统按 `\n` 换行符分割命令，每行独立执行

**注释规则：**
- 以 `#` 开头的行视为注释，会被忽略
- 空行会被过滤

---

## 二、动态占位符（Dynamic Placeholders）

命令内容中可使用占位符，系统会在执行前自动替换为实际值。

**重要说明：** 这些占位符引用的内容（变量、文件、配置、服务器）必须提前在**部署平台 Web 界面**中配置或上传：
- **变量（VAR）**：在"变量管理"模块配置
- **文件（FILE）**：在"文件管理"模块上传
- **配置（CONF）**：在"配置管理"模块创建模板文件
- **服务器（HOST）**：在"服务器管理"模块添加服务器信息

### 2.1 `[VAR:变量名]` - 变量替换

**作用：** 引用系统预定义或用户配置的变量值。

**示例：**
```bash
run: docker run -e TZ=[VAR:MYSQL_ZONE] myapp
```

- 假设 `MYSQL_ZONE` 变量值为 `Asia/Shanghai`
- 最终执行：`docker run -e TZ=Asia/Shanghai myapp`

**常见变量场景：**
- 时区配置：`[VAR:MYSQL_ZONE]`
- 数据库连接：`[VAR:DB_HOST]`、`[VAR:DB_PORT]`
- API 密钥：`[VAR:API_KEY]`

---

### 2.2 `[FILE:文件标识]` - 本地文件路径

**作用：** 引用本地上传的文件实际存储路径。

**示例：**
```bash
put: [FILE:server.jar],/root/main-server/server.jar
```

- `server.jar` 是用户上传时的文件标识（通常是原文件名）
- 系统会找到该文件在服务器本地的实际路径（如 `/data/deployer/files/abc123.jar`）
- 最终执行上传：本地 `/data/deployer/files/abc123.jar` → 远程 `/root/main-server/server.jar`

**注意事项：**
- 文件必须提前上传到部署系统的文件管理区
- 文件标识通常为上传时的原始文件名

---

### 2.3 `[CONF:配置文件名]` - 配置模板

**作用：** 引用配置文件模板，支持**递归替换**模板内的占位符。

**示例：**
```bash
put: [CONF:server.yml],/root/main-server/server.yml
```

**配置文件 `server.yml` 内容：**
```yaml
server:
  port: 8080
database:
  host: [VAR:DB_HOST]
  port: [VAR:DB_PORT]
timezone: [VAR:MYSQL_ZONE]
```

**执行流程：**
1. 读取 `server.yml` 模板
2. 替换其中的 `[VAR:...]` 占位符
3. 如果配置内容**有变化**，生成临时文件（如 `/tmp/20260813-15:23:45~server.yml`）
4. 上传临时文件到远程 `/root/main-server/server.yml`

**递归替换：**
- 配置文件内可以嵌套引用其他配置：`include: [CONF:database.yml]`
- 系统会递归解析，但会检测循环引用并报错

---

### 2.4 `[HOST:服务器标识]` - 服务器地址

**作用：** 引用已配置的服务器 IP 地址。

**示例：**
```bash
run: scp [HOST:backup-server]:/data/backup.tar.gz /tmp/
```

- `backup-server` 是服务器配置中的标识名
- 系统会替换为实际 IP，如 `192.168.1.100`
- 最终执行：`scp 192.168.1.100:/data/backup.tar.gz /tmp/`

**特殊值：**
- `[HOST:$SELF]` - 当前执行部署的目标服务器自身的 IP

---

## 三、核心命令

### 3.1 `put:` - 上传文件

**语法：**
```
put: <本地路径>,<远程路径>
```

**功能：** 通过 SFTP 上传文件到远程服务器。

**示例：**
```bash
# 上传 JAR 包
put: [FILE:server.jar],/root/main-server/server.jar

# 上传配置文件（会自动替换配置内占位符）
put: [CONF:application.yml],/etc/myapp/application.yml

# 直接路径（不推荐，应使用占位符）
put: /tmp/build.tar.gz,/opt/releases/build.tar.gz
```

**执行过程：**
- 显示上传进度（每秒更新一次百分比）
- 自动创建远程目标目录（如果不存在）
- 失败时会广播错误信息

---

### 3.2 `get:` - 下载文件

**语法：**
```
get: <远程路径>,<本地路径>
```

**功能：** 从远程服务器下载文件到部署系统本地。

**示例：**
```bash
# 下载日志文件
get: /var/log/myapp/error.log,/tmp/error.log

# 备份数据库
get: /root/backup.sql,/data/backups/backup-[VAR:DATE].sql
```

**执行过程：**
- 显示下载进度
- 本地路径可使用变量动态生成文件名

---

### 3.3 `run:` - 执行远程命令

**语法：**
```
run: <Shell 命令>
```

**功能：** 在远程服务器执行任意 Shell 命令。

**示例：**
```bash
# Docker 容器管理
run: docker stop server
run: docker rm server
run: docker run -dit --name server --network=host -v /root/logs:/logs myapp:latest

# 文件操作
run: mkdir -p /opt/myapp
run: chmod +x /opt/myapp/start.sh
run: rm -rf /tmp/old-data

# 服务管理
run: systemctl restart nginx
run: pm2 restart app

# 条件执行
run: [ -f /root/backup.tar.gz ] && rm /root/backup.tar.gz
```

**输出处理：**
- 标准输出（stdout）逐行实时显示
- 标准错误（stderr）以红色 `ERR` 标签显示
- 命令返回非 0 退出码时会中断部署流程

---

### 3.4 `rquery:` - 执行查询并存储结果

**语法：**
```
rquery: <Shell 命令>
```

**功能：** 执行命令并将**完整输出**保存到**寄存器**（register），供后续命令使用。

**示例：**
```bash
# 查询容器 ID
rquery: docker ps -q -f name=server

# 后续命令可通过 $[0] 引用寄存器内容
run: docker logs $[0]
```

**与 `run:` 的区别：**
- `run:` 输出直接显示给用户，不保存
- `rquery:` 输出不显示，存入寄存器供后续引用

---

### 3.5 `spush:` - 压入寄存器栈

**语法：**
```
spush:
```

**功能：** 将当前寄存器值压入栈，保护现场。

**示例：**
```bash
rquery: docker ps -q -f name=server
spush:
rquery: docker ps -q -f name=backup
run: docker cp $[0]:/data /backup  # 使用 backup 容器 ID
spop:
run: docker restart $[0]  # 使用 server 容器 ID（从栈恢复）
```

---

### 3.6 `spop:` - 弹出寄存器栈

**语法：**
```
spop:
```

**功能：** 从栈中弹出值并恢复到寄存器。

---

### 3.7 `reval:` - 执行 JavaScript 表达式

**语法：**
```
reval: <JavaScript 表达式>
```

**功能：** 对寄存器内容执行 JavaScript 计算，结果写回寄存器。

**示例：**
```bash
rquery: cat /proc/meminfo | grep MemTotal | awk '{print $2}'
reval: Math.floor($ / 1024)  # $ 代表寄存器当前值
run: echo "内存大小: $[0] MB"
```

**可用变量：**
- `$` - 当前寄存器值
- 支持所有 JavaScript 标准库（Math、String、Array 等）

---

### 3.8 `update:` - 更新全局变量

**语法：**
```
update: <变量名>=<变量值>
```

**功能：** 动态修改全局变量配置，影响后续所有部署任务。

**示例：**
```bash
# 更新版本号
rquery: cat /opt/myapp/version.txt
update: APP_VERSION=$[0]

# 后续脚本可使用新变量
run: echo "当前版本: [VAR:APP_VERSION]"
```

---

## 四、寄存器与栈操作

### 4.1 寄存器引用 `$[N]`

**语法：** `$[0]` 表示栈顶，`$[1]` 表示栈顶下一层，以此类推。

**示例：**
```bash
rquery: ls /data | wc -l
spush:
rquery: df -h | grep /data | awk '{print $5}'
run: echo "文件数: $[1], 磁盘使用: $[0]"
```

**规则：**
- `$[0]` = 栈顶（最新值）
- `$[1]` = 栈顶 -1
- `$[N]` = 栈顶 -N
- 空栈引用返回空字符串

---

## 五、完整部署示例

### 示例 1：Spring Boot 应用部署

```bash
# 1. 上传文件
put: [FILE:server.jar],/root/main-server/server.jar
put: [CONF:application.yml],/root/main-server/application.yml

# 2. 停止旧容器
run: docker stop server
run: docker rm server

# 3. 清理调试容器（如果存在）
run: docker stop debug-server 2>/dev/null || true
run: docker rm debug-server 2>/dev/null || true

# 4. 启动新容器（注意：命令必须写在一行，不支持 \ 续行符）
run: docker run -dit --name server --network=host -e TZ=[VAR:MYSQL_ZONE] -e SPRING_PROFILES_ACTIVE=prod -v /root/logs:/logs -v /root/main-server:/app openjdk:17-slim java -jar /app/server.jar

# 5. 等待启动并检查健康状态
run: sleep 10
rquery: docker logs --tail 20 server | grep "Started Application"
reval: $.includes("Started") ? "SUCCESS" : "FAILED"
run: echo "启动状态: $[0]"
```

---

### 示例 2：前端静态资源部署

```bash
# 1. 上传构建产物
put: [FILE:dist.tar.gz],/tmp/dist.tar.gz

# 2. 解压到 Nginx 目录
run: mkdir -p /var/www/myapp
run: tar -xzf /tmp/dist.tar.gz -C /var/www/myapp

# 3. 更新 Nginx 配置
put: [CONF:nginx.conf],/etc/nginx/sites-available/myapp.conf
run: ln -sf /etc/nginx/sites-available/myapp.conf /etc/nginx/sites-enabled/

# 4. 测试并重载 Nginx
run: nginx -t
run: systemctl reload nginx

# 5. 清理临时文件
run: rm /tmp/dist.tar.gz
```

---

### 示例 3：数据库迁移

```bash
# 1. 备份当前数据库
rquery: date +%Y%m%d-%H%M%S
update: BACKUP_TIME=$[0]
run: mysqldump -u root -p[VAR:DB_PASSWORD] mydb > /backup/mydb-[VAR:BACKUP_TIME].sql

# 2. 上传迁移脚本
put: [FILE:migrate.sql],/tmp/migrate.sql

# 3. 执行迁移
run: mysql -u root -p[VAR:DB_PASSWORD] mydb < /tmp/migrate.sql

# 4. 验证迁移结果
rquery: mysql -u root -p[VAR:DB_PASSWORD] -e "SELECT COUNT(*) FROM new_table" mydb
run: echo "新表记录数: $[0]"

# 5. 清理
run: rm /tmp/migrate.sql
```

---

## 六、最佳实践

### 6.1 错误处理

```bash
# ✅ 推荐：忽略非关键命令的错误
run: docker stop old-container 2>/dev/null || true

# ❌ 不推荐：错误会中断整个流程
run: docker stop old-container
```

### 6.2 幂等性设计

```bash
# ✅ 推荐：先检查再操作
run: [ ! -d /opt/myapp ] && mkdir -p /opt/myapp

# ✅ 推荐：强制覆盖
run: ln -sf /path/to/source /path/to/link
```

### 6.3 敏感信息保护

```bash
# ✅ 推荐：使用变量
run: mysql -u root -p[VAR:DB_PASSWORD] ...

# ❌ 禁止：硬编码密码
run: mysql -u root -pMyPassword123 ...
```

### 6.4 日志与调试

```bash
# 关键步骤添加回显
run: echo "========== 开始部署服务 =========="
run: docker ps -a | grep myapp
run: echo "========== 部署完成 =========="
```

---

## 七、系统架构说明

### 7.1 执行流程

```
用户触发部署
    ↓
读取脚本文件
    ↓
解析占位符（VAR/FILE/CONF/HOST）
    ↓
建立 SSH 连接
    ↓
逐行执行命令
    ↓
实时广播日志
    ↓
连接复用 3 分钟（避免频繁重连）
```

### 7.2 连接管理

- 同一服务器的连接会**缓存 3 分钟**
- 3 分钟内无新任务自动断开
- 支持**并发部署**到不同服务器

### 7.3 错误处理

- 命令执行失败（退出码非 0）→ 中断流程
- SSH 连接断开 → 自动清理，下次重建
- 文件上传失败 → 广播错误，中断流程

---

## 八、常见问题

### Q1: 如何调试脚本？

**答：** 添加中间步骤回显：
```bash
run: echo "当前目录内容:"
run: ls -la /opt/myapp
run: echo "环境变量:"
run: env | grep APP_
```

### Q2: 如何处理条件分支？

**答：** 使用 Shell 条件语句：
```bash
run: if [ -f /opt/myapp/config.yml ]; then echo "配置存在"; else echo "配置缺失"; exit 1; fi
```

### Q3: 如何执行多行脚本？

**答：** 方法一 - 上传脚本文件：
```bash
put: [FILE:deploy.sh],/tmp/deploy.sh
run: chmod +x /tmp/deploy.sh
run: /tmp/deploy.sh
```

方法二 - 使用 heredoc：
```bash
run: bash <<'EOF'
  cd /opt/myapp
  npm install
  npm run build
EOF
```

---

## 九、命令速查表

| 命令         | 作用                     | 示例                                  |
|--------------|--------------------------|---------------------------------------|
| `put:`       | 上传文件                 | `put: [FILE:app.jar],/opt/app.jar`    |
| `get:`       | 下载文件                 | `get: /var/log/app.log,/tmp/log.txt`  |
| `run:`       | 执行 Shell 命令          | `run: docker restart myapp`           |
| `rquery:`    | 查询并保存到寄存器       | `rquery: cat /proc/loadavg`           |
| `spush:`     | 压栈                     | `spush:`                              |
| `spop:`      | 出栈                     | `spop:`                               |
| `reval:`     | 执行 JS 表达式           | `reval: parseInt($) * 2`              |
| `update:`    | 更新全局变量             | `update: VERSION=1.2.3`               |
| `[VAR:...]`  | 引用变量                 | `[VAR:DB_HOST]`                       |
| `[FILE:...]` | 引用上传文件路径         | `[FILE:app.jar]`                      |
| `[CONF:...]` | 引用配置模板（递归替换） | `[CONF:database.yml]`                 |
| `[HOST:...]` | 引用服务器 IP            | `[HOST:backup-server]`                |
| `$[N]`       | 引用栈值                 | `$[0]` 栈顶，`$[1]` 次栈顶            |

---

## 十、扩展阅读

- **变量管理**：在 Web 界面"变量管理"模块配置全局变量
- **文件管理**：在"文件管理"模块上传 JAR/ZIP/配置文件
- **服务器配置**：在"服务器管理"模块添加服务器信息（IP、密码/密钥）
- **日志查看**：部署过程中右侧日志窗口实时显示所有操作输出

---

**文档版本：** v1.0  
**更新日期：** 2026-08-13  
**维护者：** 部署系统开发团队
