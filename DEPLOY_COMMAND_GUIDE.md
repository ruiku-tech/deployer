# 部署脚本生成指南

本文档供其他工程的开发人员和自动化工具使用，用于根据项目的构建产物、配置和部署步骤，生成可在部署平台中执行的脚本。脚本由部署平台连接目标服务器，通过 SFTP 上传文件，再通过 SSH 执行命令。

## 生成约定

部署脚本是逐行执行的命令列表。每个非空、非注释行必须以 `put:` 或 `run:` 开始；其他前缀会在部署前被拒绝。

```text
put: [FILE:构建产物名称],/目标服务器上的绝对路径
run: 目标服务器 shell 命令
```

以 `#` 开头的行是注释，空行会忽略。每个 `run:` 是单独的 SSH exec 命令，不是持续打开的终端会话；不要依赖跨行 shell 状态、shell 变量或交互式输入。需要多步 shell 逻辑时，将完整脚本作为文件上传，再用单行 `run: bash /path/to/script.sh` 执行。

自动生成脚本时，应先确认这些信息：

- 构建产物名称及它在平台文件管理中的名称。
- 目标服务器上的安装目录、文件名和服务名。
- 发布前后需要执行的命令及其顺序。
- 配置中需使用的平台变量、配置模板、服务器标识和运行时参数。
- 每一步是否可重复执行，以及失败时应该由非零退出码中止发布。

生成结果只使用 `put:` 和 `run:`，不要生成平台本地 shell 命令或其他命令前缀。

## 命令

### `put:` 上传文件

```text
put: <本地来源>,<远程目标路径>
```

通常使用 `[FILE:...]` 选择本次部署上传的构建产物：

```bash
put: [FILE:service.jar],/opt/example/service.jar
put: [FILE:release.tar.gz],/tmp/release.tar.gz
```

配置模板可以用 `[CONF:...]` 生成实际上传来源：

```bash
put: [CONF:application.yml],/opt/example/application.yml
```

本地来源必须是当前环境 `files`、`configs` 或 `temp` 目录中的普通文件。不能指定平台机器上的任意路径、目录或符号链接。配置模板含有动态占位符时，平台会先生成临时配置文件；没有变化时则直接使用模板文件。

远程目标路径应写成完整文件路径，且其父目录必须已存在。`put:` 只负责上传，不会自动在远程服务器创建目录。

### `run:` 执行远程命令

```text
run: <目标服务器上的 shell 命令>
```

示例：

```bash
run: mkdir -p /opt/example
run: systemctl restart example
run: systemctl is-active --quiet example
```

`run:` 在目标服务器执行 shell 命令。退出码非零会使当前部署项失败。脚本作者应只生成目标工程所需的远程命令，并谨慎处理 `rm`、权限修改和数据迁移等有破坏性的操作。

## 动态占位符

占位符可以出现在 `run:` 命令和配置模板中。引用的资源需预先在当前环境配置。

| 占位符 | 用途 | 示例 |
| --- | --- | --- |
| `[VAR:变量名]` | 替换全局变量 | `[VAR:APP_PORT]` |
| `[FILE:文件名]` | 选择本次部署上传的文件 | `[FILE:service.jar]` |
| `[CONF:配置名]` | 展开配置模板；支持嵌套配置 | `[CONF:application.yml]` |
| `[HOST:服务器名]` | 替换为服务器地址 | `[HOST:production-1]` |
| `[HOST:$SELF]` | 替换为当前目标服务器地址 | `[HOST:$SELF]` |
| `[TEXT:提示文字]` | 在部署确认窗口输入单行参数 | `[TEXT:演示分钟数]` |

相同的 `TEXT` 提示在一次发布中只要求输入一次。参数不能为空，最长 4096 个字符，不允许换行。平台按原文替换 `TEXT`，不会自动进行 shell 转义；请在脚本中将占位符放在合适的参数位置，并避免让用户输入 shell 语法。

配置模板可以嵌套引用其他配置，循环引用会被拒绝。`FILE` 可在配置模板中使用，运行时仍会由操作者在发布确认窗口选择实际文件。

## 文件管理和克隆

`[FILE:name]` 中的 `name` 对应当前环境文件管理中的文件名。每个被引用的文件都会在发布确认窗口中显示，操作者为它选择实际上传文件。未选择必需文件时不能开始发布。

配置和脚本可以从列表中的“克隆”复制到另一个有访问权限的环境。平台会先显示目标环境的现有配置或脚本；如果目标已有相同名称，克隆会被拒绝，不会覆盖。克隆后可在目标环境编辑相似但不同的内容。

## 非交互脚本

SSH 执行使用非交互通道，不会打开终端供部署人员回答提示。安装包、包管理器和初始化工具应选择非交互选项，例如：

```bash
run: DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
run: yum install -y nginx
run: dnf install -y nginx
```

部署命令通过不带 PTY 的 SSH exec 通道运行，无法通用判断远端进程是否正在等待输入。平台会识别常见提示（如 `[Y/n]`、`password:`、`Press Enter`），并发出交互输入警告；120 秒没有输出但没有匹配提示时也会提醒命令仍在运行。**空闲提醒不会自动终止命令**，操作者可观察日志，或使用服务器项旁的取消按钮中止。安装和包管理命令仍应显式使用 `-y`、`--assume-yes` 等非交互参数。

stdout 和 stderr 都会作为普通日志显示。Docker 等程序常把正常进度写入 stderr，因此 stderr 本身不代表失败。命令以非零退出码结束、SSH 连接失败或命令超时才会产生错误日志；前端以红色显示真正的 `ERR` 日志。

## 示例

### Java 服务

```bash
# 本次上传选择 service.jar，远程安装目录应已创建。
put: [FILE:service.jar],/opt/example/service.jar
put: [CONF:application.yml],/opt/example/application.yml
run: systemctl restart example
run: systemctl is-active --quiet example
```

### Docker 服务

```bash
put: [FILE:compose.yaml],/opt/example/compose.yaml
run: docker pull [VAR:IMAGE_NAME]:[TEXT:发布版本]
run: docker compose -f /opt/example/compose.yaml up -d
run: docker compose -f /opt/example/compose.yaml ps
```

### 生成后执行部署脚本

把完整的多行部署脚本作为构建产物上传到当前环境的文件管理，再由脚本命令调用：

```bash
put: [FILE:deploy.sh],/tmp/example-deploy.sh
run: chmod 700 /tmp/example-deploy.sh
run: bash /tmp/example-deploy.sh
```

## 自动生成检查清单

为其他工程生成部署脚本时，确认以下事项：

- 每行只使用 `put:` 或 `run:`；注释独占一行并以 `#` 开头。
- 构建产物通过 `[FILE:...]` 选择，不引用平台机器的任意路径。
- `put:` 目标的远程父目录已经创建。
- 环境差异优先通过 `[VAR:...]`、`[CONF:...]`、`[HOST:...]` 和 `[TEXT:...]` 表达，不硬编码密钥。
- 安装和配置命令采用非交互参数，不等待键盘输入。
- 发布完成后检查服务状态或健康检查，并让失败检查返回非零退出码。
- 不生成 `get:`、`spush:`、`spop:`、`reval:`、`rquery:`、`update:` 等已移除命令，也不使用 `$[N]` 寄存器语法。
