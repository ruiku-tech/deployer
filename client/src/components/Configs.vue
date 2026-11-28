<template>
  <div class="content">
    <el-collapse v-model="collapse">
      <el-collapse-item title="点击新增" name="1">
        <div class="panel">
          <el-alert
            title="配置文件支持 [HOST:]、[CONF:]、[VAR:] 和 [TEXT:] 参数；[TEXT:] 在发布确认时填写"
            type="warning"
          />
          <el-form ref="formRef" :model="form" label-width="120px">
            <el-form-item label="配置名字" prop="name">
              <el-input v-model="form.name" placeholder="可以长一点" />
            </el-form-item>
            <el-form-item label="配置内容" prop="data">
              <div class="code-editor"><pre ref="gutter" aria-hidden="true">{{ lineNumbers }}</pre><textarea v-model="form.data" spellcheck="false" wrap="off" @scroll="syncScroll" @keydown.tab.prevent="insertTab"></textarea></div>
            </el-form-item>
            <el-form-item label="备注" prop="note"><el-input v-model="form.note" /></el-form-item>
            <el-form-item>
              <el-button type="primary" @click="save">保存</el-button>
              <el-button @click="reset">重置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-collapse-item>
    </el-collapse>

    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>配置列表</span>
          <el-button class="button" @click="fresh">刷新</el-button>
        </div>
      </template>
      <el-table :data="list" style="width: 100%">
        <el-table-column prop="name" label="配置名字"><template #default="scope">{{ scope.row.name }} <el-tooltip v-if="scope.row.note" :content="scope.row.note"><span class="note-icon">?</span></el-tooltip></template></el-table-column>
        <el-table-column label="操作" width="190">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="edit(scope.row)"
              >修改</el-button
            >
            <el-button link type="primary" size="small" @click="openClone(scope.row)">克隆</el-button>
            <el-button link type="primary" size="small" @click="del(scope.row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <ResourceCloneDialog v-model="cloneVisible" resource-type="config" :resource-name="cloneName" @cloned="fresh" />
  </div>
</template>

<script>
import { ElMessage } from "element-plus";
import { deleteConfig, fetchConfig, fetchConfigs, saveConfig } from "../api";
import { confirmDelete } from "../utils";
import ResourceCloneDialog from './ResourceCloneDialog.vue';
export default {
  name: "configs",
  components: { ResourceCloneDialog },
  data() {
    return {
      list: [],
      form: {
        name: "",
        data: "",
        note: "",
      },
      collapse: [],
      cloneVisible: false,
      cloneName: '',
    };
  },
  computed: { lineNumbers() { return this.form.data.split('\n').map((_, i) => i + 1).join('\n'); } },
  mounted() {
    this.fresh();
  },
  methods: {
    fresh() {
      fetchConfigs().then((data) => {
        this.list = data;
      });
    },
    del(item) {
      confirmDelete().then(() => {
        deleteConfig(item.name).then(this.fresh)
      });
    },
    edit(item) {
      this.form.note = item.note || '';
      fetchConfig(item.name).then((data) => {
        this.form.name = item.name;
        this.form.data = data;
      });
      this.collapse = ["1"];
    },
    openClone(item) { this.cloneName = item.name; this.cloneVisible = true; },
    save() {
      if (!this.form.name) {
        return ElMessage.error("请输入配置名字");
      }
      if (!this.form.data) {
        return ElMessage.error("请输入配置内容");
      }
      saveConfig(this.form.name, this.form.data, this.form.note)
        .then(this.fresh)
        .then(this.reset);
    },
    reset() {
      this.$refs.formRef.resetFields();
    },
    syncScroll(event) { this.$refs.gutter.scrollTop = event.target.scrollTop; },
    insertTab(event) {
      const input = event.target;
      const start = input.selectionStart;
      this.form.data = this.form.data.slice(0, start) + '  ' + this.form.data.slice(input.selectionEnd);
      this.$nextTick(() => { input.selectionStart = input.selectionEnd = start + 2; });
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.code-editor { display: flex; width: 100%; height: 320px; border: 1px solid #dcdfe6; border-radius: 4px; overflow: hidden; background: #fff; }
.code-editor pre, .code-editor textarea { box-sizing: border-box; margin: 0; padding: 10px; border: 0; font: 13px/20px monospace; white-space: pre; }
.code-editor pre { width: 48px; flex: none; overflow: hidden; text-align: right; color: #929ba6; background: #f5f7fa; user-select: none; }
.code-editor textarea { flex: 1; resize: none; outline: none; overflow: auto; tab-size: 2; }
.note-icon { display: inline-flex; justify-content: center; align-items: center; width: 15px; height: 15px; border: 1px solid #a8abb2; border-radius: 50%; color: #909399; font-size: 11px; cursor: help; }
</style>
