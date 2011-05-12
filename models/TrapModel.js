module.exports = function(mongoose) {
    if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {
        var Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId;
        var TrapSchema = new Schema({
            '_id' : Number,
            'user' : String,
            'class' : Number,
            'date' : Date,
            'level' : Number
        });
        mongoose.model('Trap',TrapSchema);
    }
    return mongoose;
};