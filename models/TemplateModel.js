//Model Template

module.exports = function(mongoose) {

        if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {

                //Begin Shorthand Definitions
                var Schema = mongoose.Schema,
                ObjectId = Schema.ObjectId;
                //End Shorthand Definitions

                var ThisSchema = new Schema({                           //Change 'This' to the object name
                        'id' : ObjectId,                                //id should always look like this
                        'count' : Number                                //properties are 'name' : Type
                });

                mongoose.model('This',ThisSchema);                      //Change 'This' to object name. Case Sensitive

        } //End If

        return mongoose;

}; //End modules.exports

