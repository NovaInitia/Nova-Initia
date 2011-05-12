module.exports = function(mongoose) {
    if(mongoose && mongoose.Schema && mongoose.Schema.ObjectId) {
        var Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId;
        var SpiderSchema = new Schema({
            '_id' : Number,
            'user' : String,
            'class' : Number,
            'date' : Date,
            'level' : Number
        });    
        SpiderSchema.virtual("awardableXP").set(function (user) {   //When called, returns the amount of XP the placer can gain.
            var age = new Date().getTime() - this.date.getTime();   //Number of milliseconds since the spider was placed.
            var exp = NI.tools.spiders.experience.sort(function (a,b) {return a.age - b.age;});     //Settings array of {age: <days>, amount: <XP to award>}. Sorted so lower age is first.
            for (var i = exp.length;i >= 0;--i) {   //Loop though the settigns array. Start at the end because the first element should always return true.
                if (exp[i].age <= age)  //Check to see if this is the last element in exp that matches our age variable.
                    return exp[i].xp;   //Return the XP to award.
            }
            return 0;   //Whoops, none matched.
        })
        SpiderSchema.virtual("explode").set(function (user) {
            
        })
        SpiderSchema.virtual("backfire").set(function (user) {
            
        })
        mongoose.model('Spider',SpiderSchema);
    }
    return mongoose;
}