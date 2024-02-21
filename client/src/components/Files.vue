<template>
  <div class="content">
    <div class="panel">
      <input ref="file" type="file" placeholder="请选择文件" />
      <el-button type="primary" round @click="upload">上传</el-button>
    </div>
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>文件列表</span>
          <el-button class="button" @click="fresh">刷新</el-button>
        </div>
      </template>
      <el-table :data="list" style="width: 100%">
        <el-table-column prop="file" label="文件名" />
        <el-table-column prop="size" label="大小" />
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
        uploadFile(file.files[0]).then(()=>{
          setTimeout(this.fresh, 1000);
        });
      } else {
        ElMessage.error("请先选择文件");
      }
    },
    delFile(item) {
      confirmDelete().then(() => {
        deleteFile(item.file).then(()=>{
          setTimeout(this.fresh, 1000);
        });
      });
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
