
module.exports = function(mongoose) {

        if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {

                //Begin Shorthand Definitions
                var Schema = mongoose.Schema,
                ObjectId = Schema.ObjectId;
                //End Shorthand Definitions




                
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

                mongoose.model('Signpost',SignpostSchema);
                

        } //End If

        return mongoose;

}; //End modules.exports
