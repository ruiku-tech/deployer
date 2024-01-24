import service from "./base";

export function fetchFiles() {
  return service.get("/files");
}

export function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  return service.post("/file", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}

export function deleteFile(name) {
  service.delete(`/file?name=${encodeURIComponent(name)}`);
}
