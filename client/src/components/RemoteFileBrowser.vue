<template>
  <el-dialog
    v-model="visible"
    :title="`文件浏览器 - ${hostInfo.name} (${hostInfo.host})`"
    width="70%"
    :before-close="handleClose"
    :close-on-click-modal="false"
  >
    <div class="file-browser">
      <!-- 路径输入框 -->
      <div class="path-bar">
        <el-input
          v-model="currentPath"
          placeholder="请输入路径"
          @keyup.enter="loadPath"
        >
          <template #prepend>
            <el-icon><Folder /></el-icon>
          </template>
          <template #append>
            <el-button @click="loadPath" type="primary">
              <el-icon><RefreshRight /></el-icon>
            </el-button>
          </template>
        </el-input>
      </div>

      <!-- 文件列表 -->
      <div class="file-list">
        <el-table
          :data="fileList"
          v-loading="loading"
          style="width: 100%"
          @row-click="handleRowClick"
          height="400"
        >
          <el-table-column label="名称" min-width="200">
            <template #default="scope">
              <div class="file-item">
                <el-icon v-if="scope.row.isDirectory" color="#409EFF" :size="18">
                  <Folder />
                </el-icon>
                <el-icon v-else color="#67C23A" :size="18">
                  <Document />
                </el-icon>
                <span class="file-name">{{ scope.row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="大小" width="180">
            <template #default="scope">
              <template v-if="scope.row.isDirectory || scope.row.sizeBytes == null">-</template>
              <template v-else>
                <div class="size-mb">{{ formatMB(scope.row.sizeBytes) }}</div>
                <div class="size-bytes">{{ scope.row.sizeBytes.toLocaleString() }} 字节</div>
              </template>
            </template>
          </el-table-column>
          <el-table-column prop="permissions" label="权限" width="120" />
          <el-table-column label="操作" width="130">
            <template #default="scope">
              <div v-if="!scope.row.isDirectory" class="download-cell">
                <el-button
                  link
                  type="success"
                  size="small"
                  :loading="downloading === scope.row.name && downloadProgress[scope.row.name] == null"
                  :disabled="downloading === scope.row.name"
                  @click.stop="downloadFile(scope.row)"
                >
                  <span v-if="downloading === scope.row.name && downloadProgress[scope.row.name] != null">
                    {{ downloadProgress[scope.row.name] }}%
                  </span>
                  <span v-else-if="downloading === scope.row.name">准备中...</span>
                  <span v-else>下载</span>
                </el-button>
                <el-progress
                  v-if="downloading === scope.row.name && downloadProgress[scope.row.name] != null"
                  :percentage="downloadProgress[scope.row.name]"
                  :stroke-width="4"
                  :show-text="false"
                  class="download-progress"
                />
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </el-dialog>
</template>

<script>
import { Folder, Document, RefreshRight } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { fetchRemoteFiles, downloadRemoteFile } from "../api";

export default {
  name: "RemoteFileBrowser",
  components: {
    Folder,
    Document,
    RefreshRight,
  },
  data() {
    return {
      visible: false,
      hostInfo: {},
      currentPath: "/",
      fileList: [],
      loading: false,
      downloading: "",
      downloadProgress: {},
    };
  },
  methods: {
    open(hostInfo) {
      this.hostInfo = hostInfo;
      this.visible = true;
      this.currentPath = "/";
      this.loadPath();
    },
    loadPath() {
      if (!this.currentPath.trim()) {
        return ElMessage.error("请输入路径");
      }

      this.loading = true;
      fetchRemoteFiles(this.hostInfo.name, this.currentPath)
        .then((files) => {
          this.fileList = files;
        })
        .catch((err) => {
          ElMessage.error("读取目录失败: " + (err.message || "未知错误"));
        })
        .finally(() => {
          this.loading = false;
        });
    },
    handleRowClick(row) {
      if (row.isDirectory) {
        if (row.name === "..") {
          const parts = this.currentPath.split("/").filter((p) => p);
          parts.pop();
          this.currentPath = "/" + parts.join("/");
        } else {
          this.currentPath = this.joinPath(this.currentPath, row.name);
        }
        this.loadPath();
      }
    },
    downloadFile(file) {
      const filePath = this.joinPath(this.currentPath, file.name);

      this.downloading = file.name;
      this.$set ? this.$set(this.downloadProgress, file.name, null) : (this.downloadProgress[file.name] = null);
      ElMessage.info(`开始下载: ${file.name}，大文件请耐心等待...`);

      downloadRemoteFile(this.hostInfo.name, filePath, file.name, file.sizeBytes, (percent) => {
        this.downloadProgress[file.name] = percent;
      })
        .then(() => {
          ElMessage.success("下载成功: " + file.name);
        })
        .catch((err) => {
          ElMessage.error("下载失败: " + (err.message || "未知错误"));
        })
        .finally(() => {
          this.downloading = "";
          delete this.downloadProgress[file.name];
        });
    },
    joinPath(base, name) {
      if (base.endsWith("/")) {
        return base + name;
      }
      return base + "/" + name;
    },
    handleClose() {
      this.visible = false;
      this.fileList = [];
      this.currentPath = "/";
    },
    /** 将字节数格式化为可读的 MB/KB/B 字符串 */
    formatMB(bytes) {
      if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
      }
      if (bytes >= 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
      }
      return bytes + " B";
    },
  },
};
</script>

<style scoped>
.file-browser {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.path-bar {
  width: 100%;
}

.file-list {
  width: 100%;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.file-name {
  user-select: none;
}

.size-mb {
  font-weight: 500;
}

.size-bytes {
  font-size: 11px;
  color: #909399;
}

.download-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.download-progress {
  width: 100%;
}

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}
</style>
