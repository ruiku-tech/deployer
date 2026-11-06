<template>
  <div class="content">
    <el-card><template #header><div class="card-header"><span>成员管理</span><el-button @click="load">刷新</el-button></div></template>
      <el-table :data="users">
        <el-table-column prop="username" label="成员" min-width="160" />
        <el-table-column label="角色" min-width="130"><template #default="s">{{ roleLabel(s.row.role) }}</template></el-table-column>
        <el-table-column label="启用" width="100"><template #default="s"><el-switch :model-value="!s.row.disabled" @change="v => toggle(s.row, v)" :disabled="s.row.role === 'superadmin' || (s.row.role === 'admin' && !isSuperAdmin)" /></template></el-table-column>
        <el-table-column v-if="isSuperAdmin" label="权限设置" width="160"><template #default="s">
          <span v-if="s.row.role === 'superadmin'" class="protected-role">超级管理员</span>
          <el-button v-else link :type="s.row.role === 'admin' ? 'danger' : 'primary'" :loading="changingRole === s.row.id" :disabled="changingRole !== null || (!!s.row.disabled && s.row.role !== 'admin')" @click="changeRole(s.row)">{{ s.row.role === 'admin' ? '取消管理员' : '设为管理员' }}</el-button>
        </template></el-table-column>
      </el-table>
    </el-card>
    <el-card class="team-card"><template #header><div class="card-header"><span>分组与通知</span><el-button type="primary" @click="edit()">新建分组</el-button></div></template>
      <el-table :data="teams"><el-table-column prop="name" label="分组"/><el-table-column label="成员"><template #default="s">{{ s.row.members.map(id => userName(id)).join('、') || '暂无成员' }}</template></el-table-column><el-table-column label="群通知"><template #default="s">{{ s.row.telegramConfigured ? '已配置' : '未配置' }}</template></el-table-column><el-table-column label="操作"><template #default="s"><el-button link type="primary" @click="edit(s.row)">修改</el-button></template></el-table-column></el-table>
    </el-card>
    <el-card class="team-card">
      <template #header><div class="card-header"><span>环境归属</span><el-button @click="load">刷新</el-button></div></template>
      <p class="group-description">每个环境仅属于一个分组，该分组的成员共享环境访问权限。</p>
      <el-table :data="environments" empty-text="暂无环境，请在右上角创建环境" style="width: 100%">
        <el-table-column prop="name" label="环境" min-width="180" />
        <el-table-column label="所属分组" min-width="180"><template #default="s">{{ s.row.teamName || '未设置' }}</template></el-table-column>
        <el-table-column label="操作" width="150"><template #default="s"><el-button link type="primary" @click="editEnvironment(s.row)">设置所属分组</el-button></template></el-table-column>
      </el-table>
    </el-card>
    <EnvGroupDialog v-model="groupVisible" :environment="selectedEnvironment" :teams="teams" @saved="load" />
    <el-dialog v-model="visible" :title="form.id ? '修改分组' : '新建分组'" width="560px">
      <el-form label-width="100px">
        <el-form-item label="分组名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="分组成员"><el-select v-model="form.members" multiple placeholder="选择成员" style="width: 100%"><el-option v-for="user in users" :key="user.id" :label="user.username" :value="user.id" /></el-select></el-form-item>
        <el-form-item label="机器人令牌"><el-input v-model="form.telegramToken" type="password" show-password :placeholder="form.id ? '留空保持原令牌' : '留空表示不启用通知'" autocomplete="new-password" /></el-form-item>
        <el-form-item label="群聊编号"><el-input v-model="form.telegramChat" placeholder="Telegram 群聊编号，留空关闭通知" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>
<script>
import { fetchTeams, fetchUsers, setUser, setUserRole, saveTeam, fetchEnvs } from '../api';
import { ElMessage, ElMessageBox } from 'element-plus';
import EnvGroupDialog from './EnvGroupDialog.vue';
import dataCenter from '../dataCenter';
export default {
  components: { EnvGroupDialog },
  data() { return { users: [], teams: [], environments: [], visible: false, form: {}, groupVisible: false, selectedEnvironment: null, changingRole: null }; },
  computed: { isSuperAdmin() { return dataCenter.role.value === 'superadmin'; } },
  mounted() { this.load(); },
  methods: {
    load() { return Promise.all([fetchUsers(), fetchTeams(), fetchEnvs()]).then(([u, t, e]) => { this.users = u || []; this.teams = t || []; this.environments = e || []; dataCenter.envList.value = this.environments; }).catch(() => {}); },
    editEnvironment(environment) { this.selectedEnvironment = environment; this.groupVisible = true; },
    userName(id) { return this.users.find(u => u.id === id)?.username || id; },
    toggle(row, value) { setUser({ id: row.id, disabled: !value }).then(this.load).catch(() => {}); },
    roleLabel(role) { return { superadmin: '超级管理员', admin: '管理员', member: '成员' }[role] || '成员'; },
    async changeRole(row) {
      if (this.changingRole !== null) return;
      const role = row.role === 'admin' ? 'member' : 'admin';
      this.changingRole = row.id;
      try {
        await ElMessageBox.confirm(role === 'admin'
          ? `确认将“${row.username}”设为管理员？该成员将能够管理成员、分组和全部环境。`
          : `确认取消“${row.username}”的管理员权限？取消后该成员仅可访问所属分组的环境。`, '设置管理员', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' });
        await setUserRole(row.id, role);
        ElMessage.success(role === 'admin' ? '已设为管理员' : '已取消管理员');
        await this.load();
      } catch { /* Includes user cancellation. */ }
      finally { this.changingRole = null; }
    },
    edit(team) { this.form = { id: team?.id, name: team?.name || '', members: [...(team?.members || [])], telegramToken: '', telegramChat: team?.telegram_chat || '' }; this.visible = true; },
    save() { if (!this.form.name.trim()) return ElMessage.error('请输入分组名称'); saveTeam(this.form).then(() => { this.visible = false; this.load(); ElMessage.success('分组已保存'); }); },
  },
};
</script>
<style scoped>.team-card { margin-top: 20px; }.group-description { margin: 0 0 16px; font-size: 13px; color: #6b7280; }.protected-role { color: #909399; font-size: 13px; }</style>
