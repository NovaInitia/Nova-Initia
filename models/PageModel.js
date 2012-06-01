
module.exports = function(mongoose) {

        if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {

                //Begin Shorthand Definitions
                var Schema = mongoose.Schema;
                //End Shorthand Definitions

                var PageModel = {
                        '_id' : String,
                        'domain' : String,
                        'users' : [],
                        'traps' : [],
                        'barrels' : [],
                        'spiders' : [],
                        'doorways' : [],
                        'signposts' : [],
                        'parts' : []
                };
                
                var PageSchema = new Schema(PageModel);
                
                mongoose.models.base.PageModel = PageModel;

                mongoose.model('Page',PageSchema);

        } //End If

        return mongoose;

};