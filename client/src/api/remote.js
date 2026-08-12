import service from "./base";

// 获取远程服务器的文件列表
export function fetchRemoteFiles(serverName, path) {
  return service.get("/remote-files", {
    params: {
      serverName,
      path,
    },
  });
}

// 下载远程服务器的文件（大文件优化：timeout: 0 + 浏览器原生流式下载）
export function downloadRemoteFile(serverName, filePath, fileName) {
  return service
    .get("/remote-download", {
      params: {
        serverName,
        filePath,
      },
      responseType: "blob",
      timeout: 0,          // 大文件不设超时
      headers: { nofeel: true },  // 不触发全屏 loading
    })
    .then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return response;
    });
}

