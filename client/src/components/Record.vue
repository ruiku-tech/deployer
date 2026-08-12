<template>
  <div class="content">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>发布记录</span>
          <el-select
            v-model="filterEnv"
            placeholder="全部环境"
            clearable
            size="small"
            style="width: 140px"
            @change="onEnvChange"
          >
            <el-option label="全部环境" value="" />
            <el-option
              v-for="item in envList"
              :key="item.name"
              :label="item.name"
              :value="item.name"
            />
          </el-select>
        </div>
      </template>
      <el-table
        @selection-change="onSelectionChange"
        :data="list"
        style="width: 100%"
        size="small"
      >
        <el-table-column type="selection" width="40" />
        <el-table-column prop="env" label="环境" width="80">
          <template #default="scope">
            <el-tag v-if="scope.row.env" size="small" type="info">{{ scope.row.env }}</el-tag>
            <span v-else style="color: #ccc">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" width="100" />
        <el-table-column prop="time" label="时间" width="130" />
        <el-table-column prop="name" label="脚本名称" width="120" />
        <el-table-column prop="host" label="服务器" width="100"/>
        <el-table-column prop="cmds" label="内容"/>
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
import { fetchEnvs } from "../api";
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
      filterEnv: "",
      envList: [],
    };
  },
  mounted() {
    this.loadEnvs();
  },
  methods: {
    reload() {
      this.fresh();
    },
    loadEnvs() {
      fetchEnvs()
        .then((data) => {
          this.envList = data || [];
          this.fresh();
        })
        .catch(() => {
          this.fresh();
        });
    },
    fresh() {
      const user = localStorage.getItem("user");
      recordList(user, this.page, this.pageSize, this.filterEnv).then((resp) => {
        this.list = resp.list.map(item => ({
          ...item,
          time: dayjs(item.time).format("YY-MM-DD HH:mm:ss"),
        }));
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
      this.fresh();
    },
    onEnvChange() {
      this.page = 1;
      this.fresh();
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
