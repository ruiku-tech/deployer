<template>
  <div class="content deploys-page">
    <section class="toolbar">
      <div class="toolbar-field">
        <span class="field-label">编排组合</span>
        <el-select v-model="compose" aria-label="编排组合" placeholder="请选择编排组合" class="compose-select">
          <el-option v-for="item in composes" :key="item.name" :label="item.name" :value="item.name" />
        </el-select>
        <el-tooltip v-if="selectedComposeNote" :content="selectedComposeNote"><span class="note-icon">?</span></el-tooltip>
      </div>
      <el-button type="primary" @click="openComposeDialog">新增组合</el-button>
    </section>

    <section v-if="editorOpen" class="editor-panel">
      <div class="section-heading">
        <div><h2>{{ editing ? '修改部署项' : '新增部署项' }}</h2><p>选择服务器，按顺序添加需要运行的脚本</p></div>
        <el-button text @click="editorOpen = false">收起</el-button>
      </div>
      <el-form :model="form" label-position="top" class="deploy-form" @submit.prevent="save">
        <el-form-item label="部署项名称" required><el-input v-model="form.name" placeholder="例如：更新应用" /></el-form-item>
        <el-form-item label="服务器" required>
          <el-select v-model="form.host" filterable placeholder="请选择服务器"><el-option v-for="item in hosts" :key="item" :label="item" :value="item" /></el-select>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.note" placeholder="可选，说明此部署项的用途" /></el-form-item>
        <div class="script-list">
          <div class="script-heading">执行脚本 <span>按添加顺序依次运行</span></div>
          <div v-for="(cmd, index) in form.cmds" :key="index" class="script-row">
            <span class="script-index">{{ index + 1 }}</span>
            <el-select v-model="cmd.value" filterable placeholder="选择运行脚本"><el-option v-for="item in scripts" :key="item.name" :label="item.name" :value="item.name" /></el-select>
            <el-button text type="danger" @click="removeCmd(index)">移除</el-button>
          </div>
          <el-button class="add-script" plain @click="form.cmds.push({ value: '' })">＋ 添加运行脚本</el-button>
        </div>
        <div class="form-actions"><el-button type="primary" :loading="saving" @click="save">保存部署项</el-button><el-button @click="reset">重置</el-button></div>
      </el-form>
    </section>

    <section class="table-card">
      <div class="table-toolbar">
        <div class="table-title"><h2>部署项</h2><span class="muted">共 {{ list.length }} 项 · 已选 {{ selected.length }} 项</span></div>
        <div class="table-actions">
          <el-input v-model="filterKey" clearable placeholder="筛选部署项名称" class="filter-input" />
          <el-button :disabled="!compose" @click="openEditor">新增部署项</el-button>
          <el-button type="primary" :disabled="!selected.length" @click="deploy">部署</el-button>
          <el-button :disabled="!compose" @click="fresh">刷新</el-button>
          <el-button type="danger" plain :disabled="!compose" @click="delCompose">删除组合</el-button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="deploy-table" aria-label="部署编排列表">
          <colgroup><col class="check-col" /><col class="name-col" /><col class="host-col" /><col /><col class="actions-col" /></colgroup>
          <thead><tr><th class="check-cell"><el-checkbox :model-value="allSelected" :indeterminate="someSelected" :disabled="!finalList.length" aria-label="全选当前列表" @change="toggleAll" /></th><th scope="col">部署项</th><th scope="col">服务器</th><th scope="col">执行脚本</th><th scope="col">操作</th></tr></thead>
          <tbody>
            <tr v-for="row in finalList" :key="row.name" :class="{ 'is-selected': isSelected(row) }">
              <td class="check-cell"><el-checkbox :model-value="isSelected(row)" :aria-label="'选择 ' + row.name" @change="toggleRow(row)" /></td>
              <td><span class="item-name">{{ row.name }}</span><el-tooltip v-if="row.note" :content="row.note"><span class="note-icon">?</span></el-tooltip></td>
              <td>{{ row.host }}</td>
              <td><span v-for="(cmd, i) in row.cmds" :key="i" class="cmd-tag">{{ cmd }}</span></td>
              <td class="row-actions"><el-button link type="primary" @click="edit(row)">修改</el-button><el-button link type="danger" @click="del(row)">删除</el-button></td>
            </tr>
            <tr v-if="!finalList.length"><td colspan="5" class="empty">{{ filterKey ? '没有匹配的部署项' : compose ? '暂无部署项，点击“新增部署项”开始配置' : '请先新增编排组合' }}</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <el-dialog v-model="composeDialog" title="新增编排组合" width="min(480px, calc(100vw - 32px))" destroy-on-close :close-on-click-modal="!composeSaving">
      <el-form :model="newCompose" label-position="top" @submit.prevent="saveCompose">
        <el-form-item label="组合名称" required><el-input v-model="newCompose.name" autofocus placeholder="例如：应用发布、初始化、重启" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="newCompose.note" type="textarea" :rows="3" placeholder="可选，说明该组合的用途" /></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="composeSaving" @click="composeDialog = false">取消</el-button><el-button type="primary" :loading="composeSaving" @click="saveCompose">创建组合</el-button></template>
    </el-dialog>
    <el-dialog v-model="deploying" title="部署确认" width="min(1120px, calc(100vw - 40px))" top="5vh" destroy-on-close>
      <DeployConfirm :list="selected" @close="deploying = false" />
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage } from "element-plus";
import { deleteBat, fetchBat, fetchBats, fetchHosts, fetchScripts, saveBat, saveBatItem, deleteBatItem } from "../api";
import DeployConfirm from "./DeployConfirm.vue";
import { confirmDelete } from "../utils";
import dataCenter from "../dataCenter";

const blankForm = () => ({ name: "", host: "", cmds: [], note: "" });
export default {
  name: "deploys",
  components: { DeployConfirm },
  data() {
    return {
      list: [], hosts: [], scripts: [], compose: "", composes: [], form: blankForm(),
      selected: [], deploying: false, filterKey: "", editorOpen: false, editing: false,
      saving: false, composeDialog: false, composeSaving: false, newCompose: { name: "", note: "" },
    };
  },
  computed: {
    selectedComposeNote() { return this.composes.find(item => item.name === this.compose)?.note || ""; },
    finalList() { return this.list.filter(item => item.name.includes(this.filterKey)); },
    allSelected() { return this.finalList.length > 0 && this.finalList.every(item => this.isSelected(item)); },
    someSelected() { return this.finalList.some(item => this.isSelected(item)) && !this.allSelected; },
  },
  watch: {
    compose(value) {
      dataCenter.selectedCompose = value;
      this.selected = [];
      this.list = [];
      this.editorOpen = false;
      this.reset();
      this.fresh();
    },
  },
  mounted() { this.compose = dataCenter.selectedCompose; this.reload(); },
  methods: {
    reload() {
      fetchHosts().then(data => { this.hosts = Object.keys(data); }).catch(() => {});
      fetchScripts().then(data => { this.scripts = data; }).catch(() => {});
      this.freshComposes();
    },
    async freshComposes() {
      try {
        this.composes = await fetchBats();
        if (!this.composes.some(item => item.name === this.compose)) this.compose = this.composes[0]?.name || "";
        else await this.fresh();
      } catch { /* API interceptor displays errors. */ }
    },
    async fresh() {
      if (!this.compose) { this.list = []; this.selected = []; return; }
      const compose = this.compose;
      try {
        const data = await fetchBat(compose);
        if (compose !== this.compose) return;
        this.list = Object.entries(data).map(([name, value]) => ({ ...value, name }));
        const selectedNames = new Set(this.selected.map(item => item.name));
        this.selected = this.list.filter(item => selectedNames.has(item.name));
      } catch { /* API interceptor displays errors. */ }
    },
    openComposeDialog() { this.newCompose = { name: "", note: "" }; this.composeDialog = true; },
    async saveCompose() {
      if (this.composeSaving) return;
      const name = this.newCompose.name.trim();
      if (!name) return ElMessage.error("请输入组合名称");
      if (this.composes.some(item => item.name === name)) return ElMessage.error("该组合名称已存在");
      this.composeSaving = true;
      try {
        await saveBat(name, undefined, this.newCompose.note.trim());
        this.composeDialog = false;
        this.compose = name;
        await this.freshComposes();
        this.openEditor();
        ElMessage.success("编排组合已创建，请添加部署项");
      } catch { /* API interceptor displays errors. */ }
      finally { this.composeSaving = false; }
    },
    openEditor() { this.reset(); this.editorOpen = true; },
    edit(item) {
      const { cmds, ...rest } = JSON.parse(JSON.stringify(item));
      this.form = { ...rest, note: rest.note || "", cmds: (cmds || []).map(value => ({ value })) };
      this.editing = true;
      this.editorOpen = true;
    },
    async save() {
      if (this.saving || !this.compose) return;
      if (!this.form.name.trim()) return ElMessage.error("请输入部署项名称");
      if (!this.form.host) return ElMessage.error("请选择服务器");
      if (!this.form.cmds.length || this.form.cmds.some(item => !item.value)) return ElMessage.error("请选择运行脚本");
      this.saving = true;
      try {
        await saveBatItem(this.compose, { ...this.form, name: this.form.name.trim(), cmds: this.form.cmds.map(item => item.value) });
        this.editorOpen = false;
        this.reset();
        await this.fresh();
      } catch { /* API interceptor displays errors. */ }
      finally { this.saving = false; }
    },
    reset() { this.form = blankForm(); this.editing = false; },
    removeCmd(index) { this.form.cmds.splice(index, 1); },
    isSelected(row) { return this.selected.some(item => item.name === row.name); },
    toggleRow(row) { this.selected = this.isSelected(row) ? this.selected.filter(item => item.name !== row.name) : [...this.selected, row]; },
    toggleAll(checked) {
      if (checked) {
        const map = new Map(this.selected.map(item => [item.name, item]));
        this.finalList.forEach(item => map.set(item.name, item));
        this.selected = [...map.values()];
      } else {
        const names = new Set(this.finalList.map(item => item.name));
        this.selected = this.selected.filter(item => !names.has(item.name));
      }
    },
    deploy() { if (this.selected.length) this.deploying = true; },
    async del(item) {
      const compose = this.compose;
      try { await confirmDelete(); await deleteBatItem(compose, item.name); await this.fresh(); } catch { /* Includes user cancellation. */ }
    },
    async delCompose() {
      const compose = this.compose;
      if (!compose) return;
      try { await confirmDelete(); await deleteBat(compose); await this.freshComposes(); } catch { /* Includes user cancellation. */ }
    },
  },
};
</script>

<style scoped>
.deploys-page { min-width: 0; color: #1f2937; }
.toolbar, .table-toolbar, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.toolbar { padding: 18px 20px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; flex-wrap: wrap; }
.toolbar-field, .table-actions { display: flex; align-items: center; gap: 10px; }
.field-label { font-weight: 600; white-space: nowrap; }
.compose-select { width: 260px; }
.filter-input { width: 180px; }
.note-icon { display: inline-flex; justify-content: center; align-items: center; width: 15px; height: 15px; border: 1px solid #a8abb2; border-radius: 50%; color: #909399; font-size: 11px; cursor: help; }
.editor-panel, .table-card { margin-top: 18px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
.editor-panel { padding: 22px; }
h2 { margin: 0; font-size: 15px; font-weight: 600; }
.section-heading p { margin: 6px 0 0; color: #6b7280; font-size: 13px; }
.deploy-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 18px; margin-top: 22px; }
.deploy-form .el-select { width: 100%; }
.script-list, .form-actions { grid-column: 1 / -1; }
.script-heading { margin-bottom: 12px; font-size: 14px; }
.script-heading span { margin-left: 10px; color: #9ca3af; font-size: 12px; }
.script-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.script-row .el-select { flex: 1; }
.script-index { width: 26px; height: 26px; line-height: 26px; border-radius: 6px; background: #f1f5f9; color: #64748b; text-align: center; font-size: 12px; }
.add-script { width: 100%; border-style: dashed; }
.form-actions { margin-top: 20px; }
.table-toolbar { padding: 18px 20px; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
.table-title { display: flex; align-items: center; gap: 12px; }
.muted { color: #6b7280; font-size: 13px; }
.table-actions { flex-wrap: wrap; }
.table-actions .el-button + .el-button { margin-left: 0; }
.table-wrap { width: 100%; overflow-x: auto; }
.deploy-table { width: 100%; min-width: 720px; border-collapse: collapse; table-layout: fixed; font-size: 14px; }
.check-col { width: 48px; }.name-col { width: 25%; }.host-col { width: 23%; }.actions-col { width: 140px; }
.deploy-table th, .deploy-table td { box-sizing: border-box; padding: 14px 18px; border-bottom: 1px solid #eef0f3; text-align: left; vertical-align: middle; overflow-wrap: anywhere; }
.deploy-table th { background: #f8fafc; color: #64748b; font-size: 13px; font-weight: 500; }
.deploy-table tr:last-child td { border-bottom: 0; }
.deploy-table tbody tr:hover { background: #f8fafc; }.deploy-table .is-selected { background: #f0f6ff; }
.deploy-table .check-cell { padding: 8px 12px; text-align: center; }
.row-actions { white-space: nowrap; }.item-name { font-weight: 500; margin-right: 6px; }
.cmd-tag { display: inline-block; padding: 3px 8px; margin: 3px 5px 3px 0; border-radius: 4px; background: #eef4ff; color: #315ca8; font-size: 12px; }
.deploy-table .empty { height: 150px; text-align: center; color: #9ca3af; }
@media (max-width: 900px) { .deploy-form { grid-template-columns: 1fr; } .table-actions { width: 100%; } }
@media (max-width: 580px) { .toolbar-field { width: 100%; }.compose-select { flex: 1; min-width: 0; }.filter-input { width: 100%; } }
</style>
