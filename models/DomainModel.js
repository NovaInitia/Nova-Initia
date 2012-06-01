
module.exports = function(mongoose) {

        if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {

                //Begin Shorthand Definitions
                var Schema = mongoose.Schema,
                ObjectId = Schema.ObjectId;
                //End Shorthand Definitions

                var DomainModel = {
                        '_id' : String,
                        'uri' : String,
                        'pages' : [],
                        'users' : [],
                        'hits' : Number,
                        'domains' : []
                };
                
                var DomainSchema = new Schema(DomainModel);

                mongoose.models.base.DomainModel = DomainModel;
                mongoose.model('Domain',DomainSchema);

        } //End If

        return mongoose;

}; //End modules.exports

