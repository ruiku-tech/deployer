import service from "./base";

export function fetchFiles() {
  return service.get("/files");
}

export function fetchFilesStat() {
  return service.get("/files-stat");
}

export function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  return service.post("/file", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      withProgress: 1,
    },
    timeout: 20 * 60 * 1000,
  });
}

export function deleteFile(name) {
  service.delete(`/file?name=${encodeURIComponent(name)}`);
}
