<template>
  <el-dialog
    v-model="visible"
    title="版本管理"
    width="660"
    destroy-on-close
    @open="loadVersions"
    @close="onClose"
  >
    <!-- 加载中 -->
    <div v-if="loading" class="ud-loading">
      <el-icon class="is-loading" :size="20"><Loading /></el-icon>
      <span>正在获取版本列表...</span>
    </div>

    <!-- 获取失败 -->
    <div v-else-if="fetchError" class="ud-error">
      <el-alert :title="fetchError" type="error" show-icon :closable="false" />
      <el-button style="margin-top: 12px" @click="loadVersions">重试</el-button>
    </div>

    <!-- 版本列表 -->
    <div v-else class="ud-body">
      <div class="ud-current">
        <span class="ud-current-label">当前版本</span>
        <el-tag type="success" size="small">{{ currentVersion }}</el-tag>
      </div>

      <div class="ud-list">
        <div
          v-for="release in versions"
          :key="release.tag"
          class="ud-item"
          :class="{ 'ud-item--current': release.tag === currentVersion }"
        >
          <div class="ud-item-header">
            <div class="ud-item-meta">
              <span class="ud-item-tag">{{ release.tag }}</span>
              <el-tag v-if="release.isLatest" size="small" type="primary" effect="light">最新</el-tag>
              <el-tag v-if="release.tag === currentVersion" size="small" type="success" effect="light">已安装</el-tag>
              <span class="ud-item-date">{{ formatDate(release.publishedAt) }}</span>
            </div>
            <el-button
              type="primary"
              size="small"
              plain
              :loading="installing === release.tag"
              :disabled="release.tag === currentVersion || (!!installing && installing !== release.tag)"
              @click="install(release)"
            >
              {{ release.tag === currentVersion ? '已安装' : (installing === release.tag ? '安装中...' : '安装此版本') }}
            </el-button>
          </div>

          <div v-if="release.name && release.name !== release.tag" class="ud-item-name">
            {{ release.name }}
          </div>

          <div v-if="release.releaseNotes" class="ud-item-notes">
            <el-collapse>
              <el-collapse-item>
                <template #title>
                  <span class="ud-notes-toggle">查看更新说明</span>
                </template>
                <pre class="ud-notes-content">{{ release.releaseNotes }}</pre>
              </el-collapse-item>
            </el-collapse>
          </div>
          <div v-else class="ud-item-nonotes">暂无更新说明</div>
        </div>

        <div v-if="versions.length === 0" class="ud-empty">暂无版本信息</div>
      </div>
    </div>

    <!-- 安装成功提示条 -->
    <div v-if="installMsg" class="ud-install-msg">
      <el-alert :title="installMsg" type="success" show-icon :closable="false" />
    </div>
  </el-dialog>
</template>

<script>
import { getVersions, selfUpdate } from "../api";
import { ElMessage, ElMessageBox } from "element-plus";
import { Loading } from "@element-plus/icons-vue";
import dayjs from "dayjs";

export default {
  name: "UpdateDialog",
  components: { Loading },
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      loading: false,
      fetchError: "",
      currentVersion: "",
      versions: [],
      installing: "",  // 正在安装的版本tag
      installMsg: "",
    };
  },
  computed: {
    visible: {
      get() { return this.modelValue; },
      set(val) { this.$emit("update:modelValue", val); },
    },
  },
  methods: {
    loadVersions() {
      this.loading = true;
      this.fetchError = "";
      this.versions = [];
      this.installMsg = "";
      getVersions()
        .then((data) => {
          this.currentVersion = data.currentVersion || "未知";
          this.versions = data.versions || [];
          if (data.error) {
            this.fetchError = "获取版本列表失败：" + data.error;
          }
        })
        .catch((err) => {
          this.fetchError = "获取版本列表失败：" + (err?.message || "网络错误");
        })
        .finally(() => {
          this.loading = false;
        });
    },
    install(release) {
      ElMessageBox.confirm(
        `确定要安装版本 ${release.tag} 吗？\n\n升级过程中服务会短暂重启，请确保没有正在进行的部署。`,
        "确认安装",
        {
          confirmButtonText: "确定安装",
          cancelButtonText: "取消",
          type: "warning",
        }
      ).then(() => {
        this.installing = release.tag;
        this.installMsg = "";
        selfUpdate(release.tag)
          .then((resp) => {
            this.installMsg = resp?.data || `${release.tag} 安装进程已启动，服务将在几分钟内自动重启`;
            ElMessage({ type: "success", message: this.installMsg, duration: 6000 });
          })
          .catch((err) => {
            ElMessage({
              type: "error",
              message: err?.response?.data?.err || "安装失败，请重试",
            });
          })
          .finally(() => {
            this.installing = "";
          });
      }).catch(() => {});
    },
    formatDate(iso) {
      if (!iso) return "";
      return dayjs(iso).format("YYYY-MM-DD");
    },
    onClose() {
      this.installMsg = "";
      this.fetchError = "";
    },
  },
};
</script>

<style scoped>
.ud-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 0;
  color: #909399;
  justify-content: center;
}

.ud-error {
  padding: 10px 0;
  text-align: center;
}

.ud-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ud-current {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.ud-current-label {
  font-size: 13px;
  color: #606266;
}

.ud-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 460px;
  overflow-y: auto;
}

.ud-item {
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 12px 14px;
  transition: border-color 0.2s;
}

.ud-item:hover {
  border-color: var(--el-color-primary-light-5);
}

.ud-item--current {
  border-color: var(--el-color-success-light-5);
  background: var(--el-color-success-light-9);
}

.ud-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ud-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ud-item-tag {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-family: monospace;
}

.ud-item-date {
  font-size: 12px;
  color: #909399;
  margin-left: 4px;
}

.ud-item-name {
  font-size: 13px;
  color: #606266;
  margin-top: 6px;
}

.ud-item-notes {
  margin-top: 8px;
}

.ud-item-nonotes {
  margin-top: 6px;
  font-size: 12px;
  color: #c0c4cc;
}

.ud-notes-toggle {
  font-size: 12px;
  color: #909399;
}

.ud-notes-content {
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: #606266;
  margin: 0;
  padding: 8px 0 0 0;
  max-height: 200px;
  overflow-y: auto;
}

.ud-empty {
  text-align: center;
  color: #909399;
  padding: 30px 0;
}

.ud-install-msg {
  margin-top: 12px;
}
</style>
