import { ElMessageBox } from "element-plus";

export function confirmDelete() {
  return ElMessageBox.confirm("确定删除？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  });
}
