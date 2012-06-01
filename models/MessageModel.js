//Model Template

module.exports = function(mongoose) {

        if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {

                //Begin Shorthand Definitions
                var Schema = mongoose.Schema,
                ObjectId = Schema.ObjectId;
                //End Shorthand Definitions
                
                var MessageModel = {
                        '_id' : Number,
                        'to' : String,
                        'from' : String,
                        'sub' : String,
                        'body' : String,
                        'domain' : String,
                        'date' : Date,
                        'read' : Boolean
                };

                var MessageSchema = new Schema(MessageModel);

                mongoose.models.base.MessageModel = MessageModel;
                
                mongoose.model('Message',MessageSchema);

        } //End If

        return mongoose;

};