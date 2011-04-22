module.exports = function(mongoose) {
	
	if(mongoose && mongoose.Schema) {
		
		var Schema = mongoose.Schema,
			ObjectId = Schema.ObjectId;

		var ClassSchema = new Schema({
                '_id' : Number,
                'name' : String
		});

		mongoose.model('Class', ClassSchema);
	}
	return mongoose;
};
