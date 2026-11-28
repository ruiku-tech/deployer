<template>
  <div class="help-page">
    <section>
      <h3>常见问题</h3>
      <el-collapse>
        <el-collapse-item title="部署脚本为什么不能使用 docker exec -it？" name="docker-tty">
          <p>部署命令通过 SSH 非交互通道执行，没有伪终端。去掉 <code>-it</code>，例如：</p>
          <pre>docker exec matrix register_new_matrix_user http://localhost:8008 -c /data/homeserver.yaml --no-admin -u 用户名 -p 密码</pre>
          <p>部署日志会显示 TEXT 替换后的完整命令，便于核对实际执行内容。</p>
        </el-collapse-item>
        <el-collapse-item title="脚本可以运行 top、vim、less 等命令吗？" name="interactive">
          <p>不能运行依赖键盘输入或终端控制的交互命令，例如 <code>top</code>、<code>htop</code>、<code>vim</code>、<code>less</code>。需要查看一次 top 指标时可使用批处理模式：</p>
          <pre>top -b -n 1</pre>
          <p>交互式终端请从服务器管理中的终端进入。</p>
        </el-collapse-item>
        <el-collapse-item title="安装软件时为什么会停住或失败？" name="install">
          <p>包管理器可能等待确认。部署脚本应使用非交互参数：</p>
          <pre>apt-get install -y nginx
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
yum install -y nginx
dnf install -y nginx</pre>
        </el-collapse-item>
        <el-collapse-item title="stderr 出现内容就代表命令失败吗？" name="stderr">
          <p>不代表。Docker 等程序会把正常进度写到 stderr。平台将 stderr 标记为信息日志，命令只有在退出码非零或被信号终止时才会标记为错误。</p>
        </el-collapse-item>
        <el-collapse-item title="为什么命令输出被截断？" name="log-limit">
          <p>为避免大量输出拖慢部署平台，每条命令最多转发 2000 条日志，单条最多 8192 个字符，stdout 和 stderr 的转发总量最多 1 MiB。达到上限后命令仍会继续运行，但后续日志不再传输。</p>
        </el-collapse-item>
        <el-collapse-item title="多行 run 命令会共享当前目录或变量吗？" name="shell">
          <p>不会。每条 <code>run:</code> 都通过独立 SSH 命令执行。需要连续执行的步骤请放在同一行并用 <code>&amp;&amp;</code> 连接，或上传 shell 脚本后运行。</p>
          <pre>cd /opt/app &amp;&amp; ./deploy.sh</pre>
        </el-collapse-item>
      </el-collapse>
    </section>

    <section>
      <h3>常用命令</h3>
      <div class="command-grid">
        <article>
          <h4>查看 Docker 日志</h4>
          <pre>docker logs --tail 100 容器名
docker logs --tail 100 -f 容器名</pre>
          <p>查看最近 100 行，第二条命令会持续跟踪。</p>
        </article>
        <article>
          <h4>过滤日志关键字</h4>
          <pre>docker logs --tail 100 容器名 2&gt;&amp;1 | grep -i -- '关键字'
docker logs --since 30m 容器名 2&gt;&amp;1 | grep -i -- 'error'</pre>
          <p><code>2&gt;&amp;1</code> 会合并标准错误和标准输出，<code>-i</code> 忽略大小写。</p>
        </article>
        <article>
          <h4>连接服务器</h4>
          <pre>ssh 用户名@服务器地址
ssh -p 端口 用户名@服务器地址</pre>
          <p>平台终端也可以直接连接已配置的服务器。</p>
        </article>
        <article>
          <h4>编辑文件</h4>
          <pre>vi /路径/文件名
nano /路径/文件名</pre>
          <p>vi 按 <code>i</code> 开始编辑，按 <code>Esc</code> 后输入 <code>:wq</code> 保存退出，输入 <code>:q!</code> 放弃修改。</p>
        </article>
        <article>
          <h4>搜索文本和文件</h4>
          <pre>grep -Rni -- '关键字' /搜索目录
find /搜索目录 -type f -name '*.yml'</pre>
          <p><code>grep -Rni</code> 递归搜索文本并显示行号，<code>find</code> 按名称查找文件。</p>
        </article>
        <article>
          <h4>检查磁盘占用</h4>
          <pre>df -h
du -sh /目标目录/* 2&gt;/dev/null | sort -h</pre>
          <p>查看文件系统空间，以及目录下各项占用。</p>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.help-page { max-width: 1120px; }
section + section { margin-top: 32px; }
h3 { margin: 0 0 16px; font-size: 17px; font-weight: 600; color: #303b4a; }
h4 { margin: 0 0 12px; font-size: 14px; color: #38465a; }
p { margin: 8px 0 0; color: #647184; font-size: 13px; line-height: 1.7; }
code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
pre { margin: 10px 0 0; padding: 12px 14px; overflow: auto; border-radius: 4px; background: #f3f5f8; color: #263341; font-size: 12px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.command-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #e8edf3; border: 1px solid #e8edf3; }
.command-grid article { min-width: 0; padding: 18px; background: #fff; }
@media (max-width: 720px) { .command-grid { grid-template-columns: 1fr; } }
</style>
