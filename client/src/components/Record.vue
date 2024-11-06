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
        size="small"
      >
        <el-table-column type="selection" width="40" />
        <el-table-column prop="username" label="用户名" width="100" />
        <el-table-column prop="time" label="时间" width="120" />
        <el-table-column prop="name" label="脚本名称" />
        <el-table-column prop="host" label="服务器" />
      </el-table>
      <el-pagination
        @current-change="onPageChange"
        background
        layout="prev, pager, next"
        :total="total"
        :size="pageSize"
        :current-page="currentPage"
      />
    </el-card>
  </div>
</template>

<script>
import { recordList, recordDelete } from "../api";
import dayjs from "dayjs";

export default {
  name: "files",
  data() {
    return {
      list: [],
      selected: [],
      page: 1,
      pageSize: 20,
      currentPage: 1,
      total: 0,
    };
  },
  mounted() {},
  methods: {
    reload() {
      this.fresh();
    },
    fresh() {
      const user = localStorage.getItem("user");
      recordList(user, this.page, this.pageSize).then((resp) => {
        this.list = resp.list.map(item=>({...item,time:dayjs(item.time).format("YY-MM-DD hh:mm:ss")}));
        this.total = resp.total;
        this.currentPage = resp.page;
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
    onPageChange(page) {
      this.page = page;
      this.fresh()
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
