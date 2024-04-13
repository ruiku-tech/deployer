<template>
  <el-dialog :title="title" v-model="dialogVisible" :show-close="false" width="400px">
    <span>{{ message }}</span>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="onCancel">取消</el-button>
        <el-button type="primary" :disabled="this.count>0" @click="onOk">
          确定<span class="dailog-counter">{{ countText }}</span>
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import { registerConfirm } from '../controller/view';

export default {
  data() {
    return {
      dialogVisible: false,
      title: '',
      message: '',
      timer: null,
      count: 0,
      option: null
    };
  },
  created() {
    registerConfirm(this)
  },
  computed: {
    countText() {
      if(this.count>0){
        return `(${this.count}S)`
      }
      return ""
    }
  },
  methods: {
    open(option) {
      this.option = option
      this.title = option.title;
      this.message = option.message;
      this.dialogVisible = true;
      return this
    },
    close() {
      this.dialogVisible = false;
      this.clearTimer()
    },
    onOk() {
      if(this.option && this.option.onOk){
        this.option.onOk()
      }
      this.close()
    },
    onCancel() {
      if(this.option && this.option.onCancel){
        this.option.onCancel()
      }
      this.close()
    },
    clearTimer(){
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = 0
      }
    },
    countDown(duration) {
      if (this.timer) {
        clearInterval(this.timer)
      }
      this.count = duration
      this.timer = setInterval(() => {
        this.count--
        if (this.count < 0) {
          this.clearTimer()
        }
      }, 1000)
    }
  }
};
</script>
<style>
.dailog-counter{
  margin-left: 4px;
}
</style>