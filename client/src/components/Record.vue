<template>
  <div class="content">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>发布记录</span>
        </div>
      </template>
      <el-table
        @selection-change="onSelectionChange"
        :data="list"
        style="width: 100%"
      >
        <el-table-column type="selection" width="40" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="scriptName" label="脚本名称" />
        <el-table-column prop="circumstances" label="环境" />
        <el-table-column prop="status" label="状态" />
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button
              link
              type="primary"
              size="small"
              @click="delFile(scope.row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script>
import { ElMessage } from "element-plus";
import { fetchFilesStat, deleteFile, uploadFile } from "../api";
import { confirmDelete } from "../utils";

export default {
  name: "files",
  data() {
    return {
      list: [],
      selected: [],
    };
  },
  mounted() {
    this.fresh();
  },
  methods: {
    fresh() {
      fetchFilesStat().then(
        (list) => (this.list = list.sort((a, b) => (a.file > b.file ? 1 : -1)))
      );
    },
    upload() {
      const file = this.$refs.file;
      if (file.files[0]) {
        uploadFile(file.files[0]).then(() => {
          setTimeout(this.fresh, 1000);
        });
      } else {
        ElMessage.error("请先选择文件");
      }
    },
    delFile(item) {
      confirmDelete().then(() => {
        deleteFile(item.file).then(() => {
          setTimeout(this.fresh, 1000);
        });
      });
    },
    onSelectionChange(selected) {
      this.selected = selected;
    },
    batDel() {
      const list = this.selected;
      if (list.length < 1) {
        return ElMessage.error("请勾选文件");
      }
      confirmDelete().then(() => {
        this.selected = [];
        const fresh = () => setTimeout(this.fresh, 1000);
        function loopDelete() {
          if (list.length < 1) {
            fresh();
            return;
          }
          const item = list.shift();
          deleteFile(item.file).finally(loopDelete);
        }
        loopDelete();
      });
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
