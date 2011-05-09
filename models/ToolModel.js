
var async = require("async");
module.exports = function(mongoose) {

        if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {

                //Begin Shorthand Definitions
                var Schema = mongoose.Schema,
                ObjectId = Schema.ObjectId;
                //End Shorthand Definitions

                var TrapSchema = new Schema({
                    '_id' : Number,
                    'user' : String,
                    'date' : Date,
                    'level' : Number
                });

                mongoose.model('Trap',TrapSchema);
                
                var BarrelSchema = new Schema({
                    '_id' : Number,
                    'user' : String,
                    'date' : Date,
                    'level' : Number,
                    'sg' : Number,
                    'traps' : Number,
                    'barrels' : Number,
                    'spiders' : Number,
                    'shields' : Number,
                    'doorways' : Number,
                    'signposts' : Number,
                    'title' : String,
                    'cmt' : String
                });

                mongoose.model('Barrel',BarrelSchema);

                var SpiderSchema = new Schema({
                    '_id' : Number,
                    'user' : String,
                    'date' : Date,
                    'level' : Number
                });

                mongoose.model('Spider',SpiderSchema);

                var DoorwaySchema = new Schema({
                    '_id' : Number,
                    'user' : String,
                    'date' : Date,
                    'level' : Number,
                    'cmt' : String,
                    'url' : String,
                    'title' : String,
                    'nsfw' : Boolean,
                    'score' : Number,
                    'votes' : Number,
                    'count' : Number,
                    'chain' : Number
                    
                });

                mongoose.model('Doorway',DoorwaySchema);
                
                var SignpostSchema = new Schema({
                    '_id' : Number,
                    'user' : String,
                    'date' : Date,
                    'level' : Number,
                    'cmt' : String,
                    'url' : String,
                    'title' : String,
                    'nsfw' : Boolean
                    
                });

                mongoose.model('Signpost',SignpostSchema);
                

        } //End If

        return mongoose;

}; //End modules.exports
/*
SpiderSchema.virtual("awardableXP").set(function () {
  var age = this.date.getTime()/24/60/60/1000;
  var exp = NI.tools.spiders.experience.sort(function (a,b) {return a.age - b.age;});
  for (var i = exp.length;i >= 0;--i) {
    if (exp[i].age <= age)
      return exp[i].amount;
  }
  return 0;
})
*/