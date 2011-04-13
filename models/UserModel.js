var util = require('util');

module.exports = function(mongoose) {

	if(mongoose && mongoose.Schema) {

		//Begin Shorthand Definitions
		var Schema = mongoose.Schema,
		ObjectId = Schema.ObjectId,
		Email = mongoose.SchemaTypes.Email;

		//End Shorthand Definitions

		var UserSchema = new Schema({
        		'_id' : String,
		        'pass' : String,
		        'ldate' : Date,
		        'key' : String,
	        	'armor' : {
		                'use' : Boolean,
		                'hits' : Number
		        },
		        'traps' : Number,			
		        'barrels' : Number,
		        'spiders' : Number,
	        	'shields' : Number,
		        'doorways' : Number,
		        'signposts' : Number,
	        	'avatar' : String,
		        'date' : Date,
		        'class' : Number,
	        	'stats' : {
		                'lvls' : {
		                        'giver' : Number,
	        	                'guardian' : Number,
	                	        'guide' : Number
		                },
		                'exp' : {
        		                'giver' : Number,
	                	        'guardian' : Number,
	                        	'guide' : Number,
		                        'trap' : {
        		                        'u' : Number,			//Used
	        	                        'h' : Number			//Hit
        	        	        },
		                        'barrel' : {
		                                'u' : Number,			//Used
        		                        'h' : Number			//Found
	                	        },
		                        'spider' : {
		                                'u' : Number,			//Used
	       		                        'h' : Number,			//Hit
					},
	        	                'shield' : {
	        	                        'u' : Number,			//Equipped
		                                'h' : Number			//Destroyed
                		        },
		                        'doorway' : {
		                                'u' : Number,			//Created
	        	                        'h' : Number			//Opened
	                	        },
	        	                'signpost' : {
		                                'u' : Number,			//Used
                		                'h' : Number			//Undecided
                        		}
		                }
		        },
		        'email' : Email,
		        'parts' : [],
		        'first' : String,
		        'last' : String,
	        	'mod' : Boolean,
		        'karma' : Number,
		        'active' : Boolean,
	        	'location' : String,
		        'cmt' : String,
		        'stamps' : [],
			'sg' : Number
		});
				

		mongoose.model('User',UserSchema);

	} //End If
	
	return mongoose;
}; //End modules.exports
