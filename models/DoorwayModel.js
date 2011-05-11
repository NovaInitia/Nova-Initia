module.exports = function(mongoose) {
    if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {
        var Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId;
        var DoorwaySchema = new Schema({
            '_id' : Number,
            'user' : String,
            'date' : Date,
            'level' : Number,
            'class' : Number,
            'cmt' : String,
            'url' : String,
            'title' : String,
            'nsfw' : Boolean,
            'score' : Number,
            'votes' : Number,
            'count' : Number,
            'chain' : Number
        });
        mongoose.model('Doorway',DoorwaySchema);
    }
    return mongoose;
};