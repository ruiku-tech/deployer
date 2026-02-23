# 远程SSH终端功能实现说明

## 功能概述
在服务器列表中新增了"终端"按钮，点击后可以打开一个交互式SSH终端，支持持续交互命令（如top、htop、vim等）。

## 实现架构

### 前端部分
1. **Terminal.vue组件**: 
   - 使用 xterm.js 实现终端模拟器
   - 通过WebSocket与后端通信
   - 支持终端大小自适应调整
   - 主题配色为深色主题

2. **Hosts.vue修改**:
   - 操作列新增"终端"按钮
   - 按钮宽度从120增加到200
   - 点击按钮打开Terminal对话框

### 后端部分
1. **terminal.js服务** (`app/service/terminal.js`):
   - 管理SSH会话
   - 使用ssh2库创建PTY伪终端
   - 支持密码和密钥两种认证方式
   - 会话管理（创建、写入、调整大小、关闭）

2. **ws.js控制器扩展** (`app/controller/ws.js`):
   - 新增`terminal()`方法处理终端WebSocket连接
   - 消息类型处理：
     - `connect`: 建立SSH连接
     - `data`: 转发用户输入
     - `resize`: 调整终端窗口大小
   - 双向数据转发：SSH输出→WebSocket，WebSocket输入→SSH

3. **路由配置** (`app/router.js`):
   - 添加WebSocket路由: `/terminal`

## 使用说明

### 1. 启动服务
```bash
# 后端
cd egg-server
npm install
npm run dev

# 前端
cd client
npm install
npm run serve
```

### 2. 使用终端
1. 打开"服务器管理"页面
2. 在服务器列表中点击任意服务器的"终端"按钮
3. 等待SSH连接建立
4. 开始使用交互式终端

### 3. 支持的功能
- ✅ 基本命令执行 (ls, pwd, cd等)
- ✅ 交互式命令 (top, htop, vim, nano等)
- ✅ 实时输出显示
- ✅ 颜色和样式支持
- ✅ 终端大小自动调整
- ✅ 多窗口同时连接不同服务器

## 技术细节

### SSH认证逻辑
```javascript
// 自动判断密码长度
if (password.length > 32) {
  // 密钥方式（PEM格式）
  connectConfig.privateKey = password;
} else {
  // 密码方式
  connectConfig.password = password;
}
```

### WebSocket消息格式
```javascript
// 客户端→服务端
{
  type: "connect" | "data" | "resize",
  data: {
    // connect时
    host: "192.168.1.1",
    port: 22,
    password: "***",
    cols: 80,
    rows: 30,
    
    // data时
    // 用户输入的字符串
    
    // resize时
    cols: 100,
    rows: 40
  }
}

// 服务端→客户端
{
  type: "data" | "error" | "connected",
  data: "数据内容或错误信息"
}
```

### PTY终端配置
```javascript
conn.shell({
  term: "xterm-256color",  // 256色支持
  cols: 80,                // 列数
  rows: 30                 // 行数
}, callback)
```

## 注意事项

1. **默认用户**: 后端默认使用`root`用户连接，可在`terminal.js`中修改
2. **会话管理**: WebSocket断开时自动清理SSH连接
3. **安全性**: 
   - 建议在生产环境使用HTTPS/WSS
   - 考虑添加访问权限控制
   - 限制可访问的服务器范围

4. **兼容性**: 需要浏览器支持WebSocket和现代ES6语法

## 依赖包

### 前端
- `xterm`: ^5.3.0 - 终端模拟器核心
- `xterm-addon-fit`: ^0.8.0 - 自适应插件
- `xterm-addon-web-links`: ^0.9.0 - 链接识别插件

### 后端
- `ssh2`: ^1.15.0 - SSH客户端（已有）
- `uuid`: ^9.0.0 - 会话ID生成
- `egg-websocket-plugin`: ^3.0.0-beta.0 - WebSocket支持（已有）

## 故障排查

### 连接失败
1. 检查服务器密码/密钥是否正确
2. 检查服务器端口是否开放（默认22）
3. 检查WebSocket连接URL是否正确

### 无法输入
1. 确认SSH连接已建立
2. 检查浏览器控制台是否有错误
3. 尝试刷新页面重新连接

### 终端显示异常
1. 调整浏览器窗口大小触发自适应
2. 检查xterm.js CSS是否正确加载
3. 检查终端主题配置

## 扩展建议

1. **用户名配置**: 允许为每个服务器配置不同的登录用户名
2. **会话保持**: 实现SSH会话的断线重连
3. **文件传输**: 在终端中集成文件上传下载功能
4. **命令历史**: 记录和搜索历史命令
5. **多标签页**: 支持同一服务器多个终端会话
6. **录制回放**: 记录终端操作用于审计
