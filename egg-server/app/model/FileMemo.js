const mongoose = require('mongoose');
const { Schema } = mongoose;

const fileSchema = new Schema({
    fileName: { type: String, required: true },
    memo: { type: String, default: '' },
    uploadTime: { type: Date, default: Date.now },
});

module.exports = mongoose.model('FileMemo', fileSchema);
