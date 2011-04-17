
module.exports = function(mongoose) {

        if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {

                //Begin Shorthand Definitions
                var Schema = mongoose.Schema,
                ObjectId = Schema.ObjectId;
                //End Shorthand Definitions

                var TrapSchema = new Schema({
                    'user' : String,
                    'date' : Date,
                    'level' : Number
                });

                mongoose.model('Domain',DomainSchema);

        } //End If

        return mongoose;

}; //End modules.exports

