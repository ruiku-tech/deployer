<template>
  <div>
    <el-table :data="details" style="width: 100%">
      <el-table-column prop="name" label="组合名字" width="150" />
      <el-table-column label="命令详情">
        <template #default="scope">
          <div v-html="scope.row.cmd.join('<br/><br/>').replace('\n','<br/>')"></div>
        </template>
      </el-table-column>
    </el-table>
    <template v-if="form.files.length">
      <el-divider>文件选择</el-divider>
      <el-form :model="form" label-width="120px">
        <el-form-item
          v-for="(f, index) in form.files"
          :key="index"
          :label="f.name"
          :prop="'f.' + index + '.value'"
          :rules="{
            required: true,
            message: '文件不可为空',
            trigger: 'blur',
          }"
        >
          <el-select v-model="f.value" size="small">
            <el-option
              v-for="item in fileOptions"
              :key="item.file"
              :label="item.file"
              :value="item.file"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </template>
    <div>
      <el-button @click.prevent="run">确认部署</el-button>
      <el-button @click.prevent="close">取消</el-button>
    </div>
  </div>
</template>

<script>
import { ElMessage } from "element-plus";
import { fetchBat, deploy, fetchFiles, fetchScript } from "../api";
export default {
  name: "deploy-confirm",
  props: ["list"],
  data() {
    return {
      fileOptions: [],
      details: [],
      form: {
        files: [],
      },
      errors: [],
    };
  },
  mounted() {
    this.initFileOptions();
    this.init();
  },
  methods: {
    initFileOptions() {
      fetchFiles().then((data) => (this.fileOptions = data));
    },
    async init() {
      const list = this.list.map(async (item) => {
        const bat = await fetchBat(item.name);
        return await Promise.all(
          bat
            .split("\n")
            .slice(1)
            .map((scriptName) => fetchScript(scriptName))
        );
      });
      const fileMap = {};
      const errors = [];
      Promise.all(list).then((list) => {
        this.details = this.list.map((item, index) => ({
          name: item.name,
          cmd: list[index],
        }));
        list.forEach((scripts, index) => {
          scripts.forEach((item) => {
            const files = item.match(/\[FILE:.+?\]/g);
            if (files) {
              files.forEach((exp) => {
                const name = exp.slice('[FILE:'.length, -1);
                const batName = this.list[index].name;
                if (fileMap[name]) {
                  errors.push(
                    `[${batName}]的文件变量[${name}]与[${fileMap[name]}]冲突`
                  );
                } else {
                  fileMap[name] = this.list[index].name;
                }
              });
            }
          });
        });
        this.errors = errors;
        this.form.files = Object.keys(fileMap).map((name) => ({
          name,
          value: "",
        }));
      });
    },
    close() {
      this.$emit("close");
    },
    run() {
      const emptys = this.form.files.filter((item) => !item.value);
      if (emptys.length) {
        return ElMessage.error(
          `请选择文件:${emptys.map((item) => item.name).join(",")}`
        );
      }
      const files = this.form.files.reduce((ret, item) => {
        ret[item.name] = item.value;
        return ret;
      }, {});
      deploy(
        this.list.map((item) => item.name),
        files
      ).then(this.close);
    },
  },
};
</script>

<style>
</style>