<template>
  <el-dialog :model-value="modelValue" :title="`克隆${resourceType === 'config' ? '配置' : '脚本'}`" width="min(760px, calc(100vw - 32px))" destroy-on-close @open="loadEnvironments" @close="$emit('update:modelValue', false)">
    <p class="source">源资源：<strong>{{ resourceName }}</strong></p>
    <el-table :data="targets" highlight-current-row @row-click="inspectTarget">
      <el-table-column prop="name" label="目标环境" min-width="180" />
      <el-table-column prop="teamName" label="所属分组" min-width="160" />
      <el-table-column label="操作" width="110"><template #default="scope"><el-button link type="primary" @click.stop="inspectTarget(scope.row)">检查冲突</el-button></template></el-table-column>
    </el-table>
    <section v-if="target" class="target-resources">
      <h3>{{ target.name }} 中的{{ resourceType === 'config' ? '配置' : '脚本' }}</h3>
      <el-table :data="resources" max-height="220" empty-text="目标环境目前没有资源">
        <el-table-column prop="name" label="名称" min-width="220" />
        <el-table-column label="同名检查" width="150"><template #default="scope"><el-tag v-if="scope.row.name === resourceName" type="danger">名称冲突</el-tag><span v-else class="available">可创建</span></template></el-table-column>
      </el-table>
      <el-alert v-if="conflict" class="conflict" type="error" :closable="false" title="目标环境已有同名资源，不能克隆或覆盖。" />
    </section>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="cloning" :disabled="!target || loadingResources || conflict" @click="clone">确认克隆</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';
import { fetchEnvs } from '../api/envs';
import { cloneResource, fetchResourceNames } from '../api/configs';
import dataCenter from '../dataCenter';

export default {
  props: {
    modelValue: Boolean,
    resourceType: { type: String, required: true },
    resourceName: { type: String, required: true },
  },
  emits: ['update:modelValue', 'cloned'],
  data() { return { targets: [], target: null, resources: [], loadingResources: false, cloning: false }; },
  methods: {
    async loadEnvironments() {
      this.target = null;
      this.resources = [];
      try {
        const environments = await fetchEnvs();
        this.targets = (environments || []).filter(item => item.name !== dataCenter.env.value);
      } catch { this.targets = []; }
    },
    async inspectTarget(target) {
      if (this.cloning) return;
      this.target = target;
      this.resources = [];
      this.loadingResources = true;
      try {
        this.resources = await fetchResourceNames(this.resourceType, target.name);
      } catch { this.target = null; }
      finally { this.loadingResources = false; }
    },
    async clone() {
      if (!this.target || this.conflict || this.loadingResources || this.cloning) return;
      try {
        await ElMessageBox.confirm(`将“${this.resourceName}”克隆到环境“${this.target.name}”，并复制备注。`, '确认克隆', {
          confirmButtonText: '确认克隆', cancelButtonText: '取消', type: 'warning',
        });
      } catch { return; }
      this.cloning = true;
      try {
        await cloneResource(this.resourceType, this.resourceName, this.target.name);
        ElMessage.success('克隆成功');
        this.$emit('cloned');
        this.$emit('update:modelValue', false);
      } catch { /* API interceptor reports conflicts and permission errors. */ }
      finally { this.cloning = false; }
    },
  },
  computed: { conflict() { return this.resources.some(item => item.name === this.resourceName); } },
};
</script>

<style scoped>
.source { margin: 0 0 12px; color: #606b78; }.target-resources { margin-top: 20px; }.target-resources h3 { margin: 0 0 10px; font-size: 14px; font-weight: 600; }.available { color: #198754; }.conflict { margin-top: 12px; }
</style>
