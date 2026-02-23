import service from "./base";

export function fetchFiles() {
  return service.get("/files");
}

export function fetchFilesStat() {
  return service.get("/files-stat");
}

export function uploadFile(file, memo) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("memo", memo);
  const encodedRemark = btoa(unescape(encodeURIComponent(memo)));
  return service.post("/file", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      withProgress: 1,
      "memo":encodedRemark
    },
    timeout: 20 * 60 * 1000,
  });
}

export function deleteFile(name) {
  return service.delete(`/file?name=${encodeURIComponent(name)}`);
}

export function APICloneFileToTargetEnv(filename, targetEnv) {
  return service.post("/clone", { filename, targetEnv });
}

export function APIDownloadFile(filePath, isFromList = false) {
  const params = isFromList 
    ? { fileName: filePath, fromList: true }
    : { filePath: filePath };
  
  return service.get("/download-file", {
    params,
    responseType: 'blob'
  }).then(response => {
    // 从响应头获取文件名
    const contentDisposition = response.headers['content-disposition'];
    let fileName = 'download';
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (fileNameMatch && fileNameMatch[1]) {
        fileName = decodeURIComponent(fileNameMatch[1]);
      }
    } else {
      // 如果没有content-disposition，从路径中提取文件名
      fileName = filePath.split('/').pop() || 'download';
    }
    
    // 创建blob URL并触发下载
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return response;
  });
}
