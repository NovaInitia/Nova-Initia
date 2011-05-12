module.exports = function(mongoose) {
    if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {
        var Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId;
        var BarrelSchema = new Schema({
            '_id' : Number,
            'user' : String,
            'class' : Number,
            'date' : Date,
            'level' : Number,
            'sg' : Number,
            'traps' : Number,
            'barrels' : Number,
            'spiders' : Number,
            'shields' : Number,
            'doorways' : Number,
            'signposts' : Number,
            'title' : String,
            'msg' : String,
            'cmt' : String,
            'looted' : String,
            'passes' : Number
        });
        mongoose.model('Barrel',BarrelSchema);
    }
    return mongoose;
};