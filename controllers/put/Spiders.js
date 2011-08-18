var controller = require("./Controller");
var UserHelper = require("../UserHelper");
module.exports = function (App) {
    var collection = "Pages";
    var property = "spiders";
    var returnProp = "page";
    
    return controller(App,
        //Write Method
        function(obj,dWrite) {
            
            //Grab pageId
            var pageId = parseInt(obj.to,10);
            
            //Arrange properties for write to Db
            delete obj.to;
            obj.date = new Date();
            obj._id = obj.date.getTime();

            var updateObj = {};
            updateObj[property] = obj;
            dWrite(
                collection,
                {_id: pageId },
                { $addToSet : updateObj },
                returnProp
            );
        },
        //Validation Method
        {
            before : function(obj, cb) {
                        var valid = typeof(obj.to) !== "undefined" && typeof(obj.from) !== "undefined";
                        if(valid) {
                            UserHelper(App,
                                {_id: obj.from, spiders : { "$gt" : 0 }},               //Query
                                {$inc : { spiders : -1 } },                             //Update
                                cb                                                      //Callback
                            );        
                        } else {
                            cb({ error : "invalid_params" });
                        }
            },
            after : function(obj) {
            }
        }
    );
};

