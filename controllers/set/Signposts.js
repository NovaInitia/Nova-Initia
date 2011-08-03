module.exports = function (App) {
    var collection = "Users";
    var property = "posts";
    return baseSet = require('../SendController')(App,
        //Write Method
        function(obj,dWrite) {

            //Grab userId
            var userId = obj.user;
            
            //Arrange properties for write to Db
            delete obj.user;
            obj.date = new Date();
            obj._id = obj.date.getTime();
            
            dWrite(collection, userId, property, obj);
        },
        //Validation Method
        function(obj) {
            return typeof(obj.url) !== "undefined" && typeof(obj.user) !== "undefined";
        });
};
