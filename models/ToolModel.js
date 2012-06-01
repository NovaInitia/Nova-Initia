
module.exports = function(mongoose) {

        if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {

                //Begin Shorthand Definitions
                var Schema = mongoose.Schema,
                ObjectId = Schema.ObjectId;
                //End Shorthand Definitions




                var ToolModel = {
                    '_id' : Number,
                    'user' : String,
                    'date' : Date,
                    'level' : Number,
                    'cmt' : String,
                    'url' : String,
                    'title' : String,
                    'nsfw' : Boolean
                    
                };
                
                var ToolSchema = new Schema(ToolModel);

                mongoose.models.base.ToolModel = ToolModel;
                
                mongoose.model('Tool',ToolSchema);
                

        } //End If

        return mongoose;

}; //End modules.exports
