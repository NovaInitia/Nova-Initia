
module.exports = function(mongoose) {

        if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {

                //Begin Shorthand Definitions
                var Schema = mongoose.Schema,
                ObjectId = Schema.ObjectId;
                //End Shorthand Definitions

                var TrapSchema = new Schema({
                    '_id' : Number,
                    'user' : String,
                    'date' : Date,
                    'level' : Number
                });

                mongoose.model('Trap',TrapSchema);
                
                var BarrelSchema = new Schema({
                    '_id' : Number,
                    'user' : String,
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
                    'cmt' : String
                });

                mongoose.model('Barrel',BarrelSchema);

                var SpiderSchema = new Schema({
                    '_id' : Number,
                    'user' : String,
                    'date' : Date,
                    'level' : Number
                });

                mongoose.model('Spider',SpiderSchema);

                var DoorwaySchema = new Schema({
                    '_id' : Number,
                    'user' : String,
                    'date' : Date,
                    'level' : Number,
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
                
                var SignpostSchema = new Schema({
                    '_id' : Number,
                    'user' : String,
                    'date' : Date,
                    'level' : Number,
                    'cmt' : String,
                    'url' : String,
                    'title' : String,
                    'nsfw' : Boolean,
                    
                });

                mongoose.model('Signpost',SignpostSchema);
                

        } //End If

        return mongoose;

}; //End modules.exports

