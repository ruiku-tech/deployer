<template>
  <el-dialog :model-value="modelValue" title="设置环境所属分组" width="min(500px, calc(100vw - 32px))" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving" @update:model-value="$emit('update:modelValue', $event)">
    <el-form label-position="top">
      <el-form-item label="环境"><el-input :model-value="environment?.name || ''" disabled /></el-form-item>
      <el-form-item label="所属分组" required>
        <el-select v-model="teamId" placeholder="请选择一个分组" style="width: 100%" :disabled="saving">
          <el-option v-for="team in teams" :key="team.id" :label="team.name" :value="team.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <p class="group-help">一个环境只能属于一个分组。保存后，新分组成员可以访问该环境，原分组成员将失去访问权限；同时属于新分组的成员仍可访问。</p>
    <template #footer><el-button :disabled="saving" @click="$emit('update:modelValue', false)">取消</el-button><el-button type="primary" :loading="saving" :disabled="!teamId || teamId === environment?.teamId" @click="save">保存</el-button></template>
  </el-dialog>
</template>
<script>
import { setEnvTeam } from '../api';
import { ElMessage } from 'element-plus';
export default {
  props: { modelValue: Boolean, environment: Object, teams: { type: Array, default: () => [] } },
  emits: ['update:modelValue', 'saved'],
  data() { return { teamId: null, saving: false }; },
  watch: { modelValue: { immediate: true, handler(value) { if (value) this.teamId = this.environment?.teamId || null; } } },
  methods: {
    async save() {
      if (this.saving || !this.environment?.name || !this.teamId) return;
      this.saving = true;
      try {
        await setEnvTeam(this.environment.name, this.teamId);
        ElMessage.success('环境所属分组已更新');
        this.$emit('update:modelValue', false);
        this.$emit('saved');
      } catch { /* API interceptor displays errors. */ }
      finally { this.saving = false; }
    },
  },
};
</script>
<style scoped>.group-help { color: #6b7280; font-size: 13px; line-height: 1.7; margin: 0; }</style>
