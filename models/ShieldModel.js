module.exports = function(mongoose) {
    if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {
        var Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId;
    }
    return mongoose;
}