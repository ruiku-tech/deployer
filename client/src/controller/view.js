let confirmNode = null;
export function registerConfirm(vnode) {
  confirmNode = vnode;
}
export function callConfirm(option) {
  if (!confirmNode) return;
  return confirmNode.open(option);
}
