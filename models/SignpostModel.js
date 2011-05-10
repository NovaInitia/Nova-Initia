module.exports = function(mongoose) {
    if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {
        var Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId;
        var SignpostSchema = new Schema({
            '_id' : Number,
            'user' : String,
            'date' : Date,
            'level' : Number,
            'cmt' : String,
            'url' : String,
            'title' : String,
            'nsfw' : Boolean
        });
    }
    return mongoose;
};