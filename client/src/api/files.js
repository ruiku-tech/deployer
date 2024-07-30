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
