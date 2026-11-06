<template>
  <div class="deploy-confirm" v-loading="loading">
    <div class="confirm-scroll">
      <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" show-icon />
      <div class="summary">本次将部署 {{ list.length }} 个部署项，请核对执行命令与发布文件。</div>
      <div v-for="item in details" :key="item.name" class="command-card">
        <div class="command-heading"><strong>{{ item.name }}</strong><span>{{ item.host }}</span></div>
        <pre v-for="(cmd, index) in item.cmd" :key="index" class="command-code">{{ cmd }}</pre>
      </div>
      <section v-if="form.files.length" class="file-section">
        <h3>发布文件</h3>
        <el-form :model="form" label-position="top">
          <el-form-item v-for="f in form.files" :key="f.name" :label="f.name" required>
            <div class="file-field">
              <el-select v-model="f.value" filterable clearable placeholder="请选择发布文件" class="file-select">
                <el-option v-for="item in fileOptions" :key="item.file" :label="item.file" :value="item.file" />
              </el-select>
              <div v-if="f.value" class="file-memo"><span class="memo-label">文件备注</span><p>{{ fileMemo(f.value) || '此文件暂无备注' }}</p></div>
            </div>
          </el-form-item>
        </el-form>
      </section>
      <section class="schedule-section">
        <div><h3>发布时间</h3><p>留空立即发布，也可以选择未来的时间定时发布</p></div>
        <el-date-picker v-model="runAt" type="datetime" placeholder="留空立即发布" :disabled-date="disabledDate" />
      </section>
    </div>
    <div class="confirm-footer">
      <span>{{ runAt ? '将在指定时间自动开始部署' : '确认后立即开始部署' }}</span>
      <div><el-button :disabled="submitting" @click="close">取消</el-button><el-button type="primary" :loading="submitting" :disabled="loading || !!loadError" @click="run">{{ runAt ? '创建定时发布' : '确认发布' }}</el-button></div>
    </div>
  </div>
</template>

<script>
import { ElMessage } from "element-plus";
import { deploy, fetchFilesStat, fetchScript } from "../api";
import { prodConfirm } from "../utils";
import dataCenter from "../dataCenter";

export default {
  name: "deploy-confirm",
  props: { list: { type: Array, required: true } },
  emits: ["close"],
  data() {
    return { fileOptions: [], details: [], form: { files: [] }, runAt: null, loading: true, submitting: false, loadError: "" };
  },
  mounted() { this.init(); },
  methods: {
    async init() {
      this.loading = true;
      try {
        const [files, scripts] = await Promise.all([
          fetchFilesStat(),
          Promise.all(this.list.map(item => Promise.all(item.cmds.map(name => fetchScript(name))))),
        ]);
        this.fileOptions = files.sort((a, b) => b.file.localeCompare(a.file));
        this.details = this.list.map((item, index) => ({ name: item.name, host: item.host, cmd: scripts[index] }));
        // A file variable may be referenced repeatedly across deployment items.
        const names = new Set();
        scripts.flat().forEach(script => {
          for (const match of script.matchAll(/\[FILE:(.+?)\]/g)) names.add(match[1]);
        });
        this.form.files = [...names].map(name => ({ name, value: "" }));
      } catch {
        this.loadError = "加载发布信息失败，请关闭弹窗后重试";
      } finally { this.loading = false; }
    },
    fileMemo(value) { return this.fileOptions.find(item => item.file === value)?.memo || ""; },
    close() { this.$emit("close"); },
    async run() {
      if (this.loading || this.loadError || this.submitting) return;
      const empty = this.form.files.filter(item => !item.value);
      if (empty.length) return ElMessage.error(`请选择文件：${empty.map(item => item.name).join("、")}`);
      const timestamp = this.runAt ? this.runAt.getTime() : undefined;
      if (this.runAt && (!Number.isFinite(timestamp) || timestamp <= Date.now())) return ElMessage.error("请选择未来的发布时间");
      const files = Object.fromEntries(this.form.files.map(item => [item.name, item.value]));
      this.submitting = true;
      try {
        await prodConfirm();
        if (timestamp && timestamp <= Date.now()) return ElMessage.error("所选发布时间已过，请重新选择");
        await deploy(this.list, dataCenter.env.value, files, timestamp);
        this.close();
      } catch { /* Cancellation is expected; API errors are shown by the interceptor. */ }
      finally { this.submitting = false; }
    },
    disabledDate(date) { const today = new Date(); today.setHours(0, 0, 0, 0); return date.getTime() < today.getTime(); },
  },
};
</script>

<style scoped>
.deploy-confirm { min-height: 160px; }
.confirm-scroll { max-height: calc(85vh - 165px); overflow-y: auto; padding: 0 8px 4px 0; }
.summary { margin: 2px 0 18px; color: #64748b; font-size: 14px; }
.command-card { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
.command-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; background: #f8fafc; overflow-wrap: anywhere; }
.command-heading strong { color: #334155; font-weight: 500; }.command-heading span { color: #64748b; font-size: 12px; }
.command-code { box-sizing: border-box; margin: 0; padding: 14px 16px; border-top: 1px solid #334155; background: #1e293b; color: #e2e8f0; font: 12px/1.7 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre; overflow-x: auto; tab-size: 4; }
.file-section { margin-top: 24px; }h3 { margin: 0 0 14px; font-size: 14px; color: #334155; font-weight: 600; }
.file-field, .file-select { width: 100%; min-width: 0; }
.file-memo { margin-top: 8px; padding: 12px 14px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; line-height: 1.6; }
.memo-label { font-size: 12px; color: #64748b; }.file-memo p { margin: 4px 0 0; color: #475569; white-space: pre-wrap; overflow-wrap: anywhere; }
.schedule-section { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding: 18px 0 10px; border-top: 1px solid #e2e8f0; }.schedule-section h3 { margin-bottom: 6px; }.schedule-section p { margin: 0; color: #64748b; font-size: 12px; }
.confirm-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 18px; padding-top: 18px; border-top: 1px solid #e2e8f0; }.confirm-footer > span { color: #64748b; font-size: 12px; }
@media (max-width: 600px) { .confirm-footer { flex-wrap: wrap; }.confirm-footer > div { margin-left: auto; }.command-heading { align-items: flex-start; flex-direction: column; gap: 4px; } }
</style>
