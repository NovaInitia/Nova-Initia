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
            'sg' : Number,          //Start barrel contents.
            'traps' : Number,
            'barrels' : Number,
            'spiders' : Number,
            'shields' : Number,
            'doorways' : Number,
            'signposts' : Number,   //End barrel contents.
            'title' : String,       //?
            'msg' : String,         //Message on the inside of the barrel.
            'cmt' : String,         //Comment on the outside of the barrel.
            'durability' : Number,  //The number of attempts at recycling that can be performed on this barrel.
            'visitors' : []         //Array of users who have checked the barrel while it was empty.
        });
        mongoose.model('Barrel',BarrelSchema);
    }
    BarrelSchema.virtual("recycle").set(function (user) {   //Returns true or false regarding an attempt to recycle.
        
    });
    BarrelSchema.virtual("recyclable").set(function (user) {    //Returns true or false. If true, subtracts one from the 'durability' of the barrel.
        
    });
    BarrelSchema.virtual("open").set(function (user) {    //Passed user function and updates it with the contents of the barrel.
        
    });
    return mongoose;
};