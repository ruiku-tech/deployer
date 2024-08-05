const mongoose = require('mongoose');
const { Schema } = mongoose;

const scriptRecord = new Schema({
    text: { type: String, required: true },
    uploadTime: { type: Date, default: Date.now },
});

module.exports = mongoose.model('script_record', scriptRecord);
