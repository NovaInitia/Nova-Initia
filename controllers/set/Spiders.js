
module.exports = function (App) {
    var collection = "Pages";
    var property = "spiders";
    return baseSet = require('../SendController')(App,
        //Write Method
        function(obj,dWrite) {
            
            //Grab pageId
            var pageId = parseInt(obj.to);
            
            //Arrange properties for write to Db
            delete obj.to;
            obj.date = new Date();
            obj._id = obj.date.getTime();
            
            dWrite("Pages",pageId,"spiders",obj);
        },
        //Validation Method
        function(opts) {
	        return typeof(obj.to) !== "undefined" && typeof(obj.from) !== "undefined";
    	});
};

