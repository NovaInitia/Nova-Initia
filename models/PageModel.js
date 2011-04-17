
module.exports = function(mongoose) {

        if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {

                //Begin Shorthand Definitions
                var Schema = mongoose.Schema,
                ObjectId = Schema.ObjectId;
                //End Shorthand Definitions

                var PageSchema = new Schema({
                        '_id' : ObjectId,
                        'hash' : String,
                        'users' : [],
                        'traps' : [],
                        'barrels' : [],
                        'spiders' : [],
                        'doorways' : []
                });

                mongoose.model('Page',PageSchema);

        } //End If

        return mongoose;

};