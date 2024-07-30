module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;

  const UserSchema = new Schema({
    cmds: { type: [ String ], required: true },
    host: { type: String, required: true },
    name: { type: String, required: true },
    username: { type: String, required: true },
    time: { type: String, required: true },
  });

  return mongoose.model('Record', UserSchema);
};
