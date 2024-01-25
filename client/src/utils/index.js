import { ElMessageBox } from "element-plus";

export function confirmDelete(msg) {
  return ElMessageBox.confirm(msg || "确定删除？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  });
}
