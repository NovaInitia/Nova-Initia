module.exports = function(mongoose) {
    if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {
        var Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId;
        var TrapModel = {
            '_id' : Number,
            'user' : String,
            'class' : Number,
            'date' : Date,
            'level' : Number
        };
        
        var TrapSchema = new Schema(TrapModel);
        
        mongoose.models.base.TrapModel = TrapModel;
        
        mongoose.model('Trap',TrapSchema);
    }
    return mongoose;
};