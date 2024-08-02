<template>
  <div class="content">
    <div class="panel">
      <input ref="file" type="file" placeholder="请选择文件" />
      <el-button type="primary" round @click="upload">上传</el-button>
      <el-input v-model="inputs" style="width: 180px;border-radius: 18px;margin-left: 10px" placeholder="关于本次更新包的介绍" />
    </div>
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>文件列表</span>
          <span>
            <el-button class="button" @click="batDel">批量删除</el-button>
            <el-button class="button" @click="fresh">刷新</el-button>
          </span>
        </div>
      </template>
      <el-table
        @selection-change="onSelectionChange"
        :data="list"
        style="width: 100%"
      >
        <el-table-column type="selection" width="40" />
        <el-table-column prop="file" label="文件名" >
          <template #default="scope">
            <span>
              {{scope.row.file.split('||')[0]}}
            </span>
          </template>
        </el-table-column>
        <el-table-column  label="版本介绍" >
          <template #default="scope">
            <span>
              {{scope.row.file.split('||')[1]}}
            </span>
          </template>
        </el-table-column>
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
            <el-button
                link
                type="primary"
                size="small"
                @click="openCloneDialog(scope.row)"
            >克隆
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showClone" title="克隆当前版本到其他环境" @close="handleClose">
      <el-form label-width="150px">
        <el-form-item label="选择环境">
          <el-select v-model="selectedOption" placeholder="请选择">
            <el-option
                v-for="option in options"
                :key="option.value"
                :label="option.label"
                :value="option.value"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" @click="handleConfirm">确定</el-button>
      </span>
    </el-dialog>
  </div>
</template>



<script>
import { ElMessage } from "element-plus";
import {fetchFilesStat, deleteFile, uploadFile, fetchEnvs, APICloneFileToTargetEnv} from "../api";
import {confirmClone, confirmDelete} from "../utils";
import dataCenter from "@/dataCenter";
import {ref} from "vue";



export default {
  setup() {
    const showClone = ref(false);
    const options = ref([]);
    const selectedOption = ref(options.value[0]?.value || '');
    const file = ref('')

    const openCloneDialog = (row) => {
      fetchEnvs().then((resp) => {
        resp.forEach(item => {
          options.value.push({ label: item.name, value: item.name });
        });
      });
      console.log('文件名称：「」',row.file)
      file.value = row.file
      showClone.value = true;
    };

    const handleConfirm = () => {
      if (!selectedOption.value) {
        ElMessage.warning('请选择一个选项');
        return;
      }
      APICloneFileToTargetEnv(file.value, selectedOption.value).then(resp =>{
        ElMessage.success(`文件已克隆至 ${selectedOption.value}`);
      })
      showClone.value = false;
    };

    const handleCancel = () => {
      showClone.value = false;
      ElMessage.info('取消克隆');
      options.value = [];
    };

    const handleClose = () => {
      showClone.value = false;
    };

    return {
      showClone,
      options,
      selectedOption,
      openCloneDialog,
      handleConfirm,
      handleCancel,
      handleClose,
    };
  },
  name: "files",
  data() {
    return {
      inputs: '',
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
        uploadFile(file.files[0], this.inputs).then(() => {
          this.inputs = '';
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
