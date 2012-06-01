module.exports = function(mongoose) {
    if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {
        var Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId;
        var DoorwayModel = {
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
        };
        
        var DoorwaySchema = new Schema(DoorwayModel);
        
        mongoose.models.base.DoorwayModel = DoorwayModel;
        mongoose.model('Doorway',DoorwaySchema);
    }
    return mongoose;
};