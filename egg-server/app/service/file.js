const { Service } = require("egg");
class FileService extends Service {
  async readFileContent(filePath) {
    try {
      const data = await fs.readFile(filePath, "utf-8");
      return { data: data };
    } catch (error) {
      return { error };
    }
  }
}
module.exports = FileService;
