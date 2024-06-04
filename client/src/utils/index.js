import { ElMessageBox } from "element-plus";
import dataCenter from "../dataCenter";
import { callConfirm } from "../controller/view";

export function confirmDelete(msg) {
  return ElMessageBox.confirm(msg || "确定删除？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
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
