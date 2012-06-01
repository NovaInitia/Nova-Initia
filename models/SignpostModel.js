module.exports = function(mongoose) {
    if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {
        var Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId;
        
        var SignpostModel = {
            '_id' : Number,
            'user' : String,
            'class' : Number,
            'date' : Date,
            'level' : Number,
            'cmt' : String,
            'url' : String,
            'title' : String,
            'nsfw' : Boolean
        };
        
        var SignpostSchema = new Schema(SignpostModel);
        mongoose.models.base.SignpostModel = SignpostModel;
        mongoose.model('Signpost',SignpostSchema);
    }
    return mongoose;
};