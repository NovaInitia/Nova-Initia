
module.exports = function(mongoose) {

        if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {

                //Begin Shorthand Definitions
                var Schema = mongoose.Schema,
                ObjectId = Schema.ObjectId;
                //End Shorthand Definitions

                var DomainSchema = new Schema({
                        '_id' : String,
			            'hash' : String,
                        'pages' : [],
                        'users' : [],
                        'score' : Number,
                        'owner' : String
                });

                mongoose.model('Domain',DomainSchema);

        } //End If

        return mongoose;

}; //End modules.exports

