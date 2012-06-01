module.exports = function(mongoose) {
	
	if(mongoose && mongoose.Schema) {
		
		var Schema = mongoose.Schema,
			ObjectId = Schema.ObjectId;

        var ClassModel = {
                '_id' : Number,
                'name' : String
        };
        
		var ClassSchema = new Schema(ClassModel);
        
        mongoose.models.base.ClassModel = ClassModel;
		mongoose.model('Class', ClassSchema);
	}
	return mongoose;
};
