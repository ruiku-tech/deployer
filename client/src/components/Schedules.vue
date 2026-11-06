<template>
  <div class="content">
    <el-card><template #header><div class="card-header"><span>定时发布</span><el-button @click="load">刷新</el-button></div></template>
      <el-table :data="list"><el-table-column prop="env" label="环境"/><el-table-column prop="items" label="部署项"/><el-table-column prop="run_at" label="发布时间（北京时间）"><template #default="s">{{ format(s.row.run_at) }}</template></el-table-column><el-table-column prop="created_by" label="创建人"/><el-table-column prop="status" label="状态"><template #default="s">{{ statusLabel(s.row.status) }}</template></el-table-column><el-table-column prop="error" label="执行说明" show-overflow-tooltip/><el-table-column label="操作" width="100"><template #default="s"><el-button v-if="s.row.status === 'pending'" link type="danger" @click="cancel(s.row.id)">取消</el-button></template></el-table-column></el-table>
    </el-card>
  </div>
</template>
<script>
import { fetchSchedules, cancelSchedule } from '../api';
import { ElMessage, ElMessageBox } from 'element-plus';
export default {
  data() { return { list: [], timer: null, fetching: false }; },
  mounted() {
    this.load();
    this.timer = setInterval(() => { if (!document.hidden) this.load(); }, 10000);
  },
  beforeUnmount() { clearInterval(this.timer); },
  methods: {
    statusLabel(v) { return { pending: '待执行', running: '执行中', success: '成功', failed: '失败', cancelled: '已取消', interrupted: '已中断' }[v] || v; },
    async load() {
      if (this.fetching) return;
      this.fetching = true;
      try { this.list = await fetchSchedules() || []; }
      catch { /* API interceptor displays errors. */ }
      finally { this.fetching = false; }
    },
    format(v) { return new Date(v).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }); },
    async cancel(id) {
      try {
        await ElMessageBox.confirm('确认取消这个定时发布？', '取消发布');
        await cancelSchedule(id);
        ElMessage.success('已取消');
        await this.load();
      } catch { /* Includes user cancellation. */ }
    },
  },
};
</script>
