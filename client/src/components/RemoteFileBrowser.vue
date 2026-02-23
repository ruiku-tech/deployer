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
          <el-table-column prop="size" label="大小" width="120" />
          <el-table-column prop="permissions" label="权限" width="120" />
          <el-table-column label="操作" width="100">
            <template #default="scope">
              <el-button
                v-if="!scope.row.isDirectory"
                link
                type="success"
                size="small"
                @click.stop="downloadFile(scope.row)"
              >
                下载
              </el-button>
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
        // 点击文件夹，进入该目录
        if (row.name === "..") {
          // 返回上级目录
          const parts = this.currentPath.split("/").filter((p) => p);
          parts.pop();
          this.currentPath = "/" + parts.join("/");
        } else {
          // 进入子目录
          const newPath = this.joinPath(this.currentPath, row.name);
          this.currentPath = newPath;
        }
        this.loadPath();
      }
    },
    downloadFile(file) {
      const filePath = this.joinPath(this.currentPath, file.name);
      
      ElMessage.info("开始下载: " + file.name);
      
      downloadRemoteFile(this.hostInfo.name, filePath, file.name)
        .then(() => {
          ElMessage.success("下载成功");
        })
        .catch((err) => {
          ElMessage.error("下载失败: " + (err.message || "未知错误"));
        });
    },
    joinPath(base, name) {
      // 处理路径拼接
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

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}
</style>
