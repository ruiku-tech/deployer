import {ElMessage, ElMessageBox, ElOption, ElSelect} from "element-plus";
import dataCenter from "../dataCenter";
import { callConfirm } from "../controller/view";
import {h, ref} from "vue";

export function confirmDelete(msg) {
  return ElMessageBox.confirm(msg || "确定删除？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  });
}

export function confirmClone(options=[]) {
    let selectedOption = ref(options[0]?.value || '');
      return ElMessageBox.confirm(
          h('div', [
            h('p',  "克隆到目标环境"),
            h(
                ElSelect,
                {
                  placeholder: '请选择',
                  modelValue: selectedOption.value,
                  'onUpdate:modelValue': value => {
                    selectedOption.value = value;
                    console.log("选择环境：「」",selectedOption.value)
                  },
                },
                options.map(option => h(ElOption, { value: option.value, label: option.value }))
            )
          ]),
          {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            type: "warning",
            dangerouslyUseHTMLString: true,
            beforeClose: (action, instance, done) => {
              if (action === 'confirm' && selectedOption) {
                ElMessage.warning('请选择一个选项');
                done(false);
              } else {
                done();
              }
            },
          }
      ).then(() => {
        return selectedOption;
      }).catch((action) => {
          if (action === 'cancel') {
              ElMessage({
                  type: 'info',
                  message: '取消克隆',
              });
          } else {
              ElMessage({
                  type: 'error',
                  message: '发生错误',
              });
          }
      });
}
export function prodConfirm() {
  const env = dataCenter.env.value;
  const isTest = env.includes("test") || env.includes("dev");
  if (isTest) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    callConfirm({
      title: "温馨提示",
      message: `确定部署到环境：${env}？`,
      onOk: resolve,
      onCancel: reject,
    }).countDown(10);
  });
}
