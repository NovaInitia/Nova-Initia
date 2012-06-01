var util = require('util');

module.exports = function(mongoose) {

    if(mongoose && mongoose.Schema) {

		//Begin Shorthand Definitions
		var Schema = mongoose.Schema,
		ObjectId = Schema.ObjectId,
		Email = mongoose.SchemaTypes.Email;

		//End Shorthand Definitions

        var UserModel = {
            '_id' : String,
            'pass' : String,    //Password for account?
		    'ldate' : Date,
		    'key' : String,
            'armor' : {
		        'use' : Boolean,    //Start inventory.
		        'hits' : Number
		    },
            'sg' : Number,
		    'traps' : Number,
		    'barrels' : Number,
		    'spiders' : Number,
            'shields' : Number,
		    'doorways' : Number,
		    'signposts' : Number,   //End inventory.
            'avatar' : String,
		    'date' : Date,
		    'class' : {},
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
                        'h' : Number			//Hit
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
            'events' : {},
		    'first' : String,
		    'last' : String,
            'mod' : Boolean,
		    'karma' : Number,
		    'active' : Boolean,
            'location' : String,
		    'cmt' : String,
		    'stamps' : [],
            'mail' : []
		};
        
		var UserSchema = new Schema(UserModel);

        
        UserSchema.virtual('awardXP').set(function(obj) {
	        switch(obj.cls) {
                case 1:
                    UserSchema.update({'_id': this._id},{'$inc': {'stats.exp.giver': obj.amount}});
                    break;
	            case 2:
                    UserSchema.update({'_id' : this._id},{'$inc': {'stats.exp.guardian' : obj.amount}});
                    break;
                case 3:
                    UserSchema.update({'_id' : this._id},{'$inc': {'stats.exp.guide' : obj.amount}});
                    break;
                default:
                    break;
            }
        });
        
	    UserSchema.virtual('addSg').set(function(amount) {
			if(this.sg + amount > 0) {
                UserSchema.update({'_id' : this._id},{'$inc': {sg: amount}});
		        return true;
			}
			return false;
        });

	    UserSchema.virtual('hitShield').set(function(amount) {
			if(this.armor.hits > 0) {
				if(this.armor.hits == 1)
					UserSchema.update({'_id' : this._id},{armor: {use: false}});
				UserSchema.update({'_id' : this._id},{'$inc': {armor : {hits : -1}}});
				return true;
			}
			return false;
        });


        
        UserSchema.virtual('toggleShield').set(function(n) {
            console.log("-----------------"+this.armor.use+"-------------------");
	        this.armor.use = !this.armor.use;
	        if(this.armor.use && parseInt(this.armor.hits,10) === 0) {
			    if(parseInt(this.shields, 10) > 0) {
	                this.shields.decrement(1);
                    this.armor.hits.increment(1);
                    if(parseInt(this['class'], 10) === 2)
	                   this.armor.hits.increment(2);
	            }
                else
                    this.armor.use = false;
            }
	        this.save();
        });
        
        mongoose.UserModel = UserModel;
		mongoose.model('User',UserSchema);
	} //End If
	return mongoose;
};
