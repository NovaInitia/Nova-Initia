module.exports = function (App) {
    var collection = "Pages";
    var property = "barrels";
    return baseSet = require('../SendController')(App,
        //Write Method
        function(obj,dWrite) {
            
            //Grab pageId
            var pageId = parseInt(obj.to);
            
            //Arrange properties for write to Db
            delete obj.to;
            obj.date = new Date();
            obj._id = obj.date.getTime();
            
            dWrite(collection,pageId,property,obj);
        },
        //Validation Method
        function(obj) {
            return (
                typeof(obj.to) !== "undefined"
                && typeof(obj.from) !== "undefined"
                && (obj.barrels || obj.traps || obj.spiders || obj.shields || obj.doorways || obj.signposts || obj.sg)
            );
        });
};