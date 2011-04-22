
module.exports = function(mongoose) {

        if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {

                //Begin Shorthand Definitions
                var Schema = mongoose.Schema;
                //End Shorthand Definitions

                var PageSchema = new Schema({
                        '_id' : String,
                        'hash' : String,
                        'domain' : String,
                        'users' : [],
                        'traps' : [],
                        'barrels' : [],
                        'spiders' : [],
                        'doorways' : [],
                        'signposts' : [],
                        'parts' : []
                });

                mongoose.model('Page',PageSchema);

        } //End If

        return mongoose;

};