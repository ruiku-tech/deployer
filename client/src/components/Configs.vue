<template>
  <div>
    <el-collapse>
      <el-collapse-item title="点击新增" name="1">
        <div class="panel">
          <el-alert
            title="配置文件内可以有[HOST:]和[CONF:]，但是不可以有[FILE:]，因为文件是动态选择的"
            type="warning"
          />
          <el-form ref="formRef" :model="form" label-width="120px">
            <el-form-item label="配置名字" prop="name">
              <el-input v-model="form.name" placeholder="可以长一点" />
            </el-form-item>
            <el-form-item label="配置内容" prop="data">
              <el-input
                v-model="form.data"
                :autosize="{ minRows: 2, maxRows: 20 }"
                type="textarea"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="save">保存</el-button>
              <el-button @click="reset">重置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-collapse-item>
    </el-collapse>

    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>配置列表</span>
          <el-button class="button" @click="fresh">刷新</el-button>
        </div>
      </template>
      <el-table :data="list" style="width: 100%">
        <el-table-column prop="name" label="配置名字" width="300" />
        <el-table-column label="操作" width="120">
          <template #default>
            <el-button link type="primary" size="small" @click="edit"
              >修改</el-button
            >
            <el-button link type="primary" size="small" @click="del"
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
import { deleteConfig, fetchConfig, fetchConfigs, saveConfig } from "../api";
export default {
  name: "configs",
  data() {
    return {
      list: [],
      form: {
        name: "",
        data: "",
      },
    };
  },
  mounted() {
    this.fresh();
  },
  methods: {
    fresh() {
      fetchConfigs().then((data) => {
        this.list = data;
      });
    },
    del(item) {
      deleteConfig(item.name).then(this.fresh);
    },
    edit(item) {
      fetchConfig(item.name).then((data) => {
        this.form.name = item.name;
        this.form.data = data;
      });
    },
    save() {
      if (!this.form.name) {
        return ElMessage.error("请输入配置名字");
      }
      if (!this.form.data) {
        return ElMessage.error("请输入配置内容");
      }
      saveConfig(this.form.name, this.form.data).then(this.fresh).then(this.reset);
    },
    reset() {
      this.$refs.formRef.resetFields();
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
