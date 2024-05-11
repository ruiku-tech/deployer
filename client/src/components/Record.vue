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
        <el-table-column prop="time" label="时间" />
        <el-table-column prop="name" label="脚本名称" />
        <el-table-column prop="host" label="服务器" />
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
import { recordList, recordDelete } from "../api";

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
      const user = localStorage.getItem("user");
      recordList(user).then((list) => {
        this.list = list;
      });
    },
    delFile(item) {
      recordDelete(item).then((data) => {
        if (data == "success") {
          this.fresh();
        }
      });
    },
    onSelectionChange(selected) {
      this.selected = selected;
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
