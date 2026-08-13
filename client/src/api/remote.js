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
// fileSize: 文件字节数（从文件列表已知），传给后端设置 Content-Length 以支持进度显示
// onProgress(percent: number) 可选，percent 为 0~100 整数
export function downloadRemoteFile(serverName, filePath, fileName, fileSize, onProgress) {
  return service
    .get("/remote-download", {
      params: {
        serverName,
        filePath,
        ...(fileSize != null ? { fileSize } : {}),
      },
      responseType: "blob",
      timeout: 0,          // 大文件不设超时
      headers: { nofeel: true },  // 不触发全屏 loading
      onDownloadProgress: onProgress
        ? (event) => {
            if (event.total) {
              onProgress(Math.round((event.loaded * 100) / event.total));
            }
          }
        : undefined,
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

