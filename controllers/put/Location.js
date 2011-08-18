var controller = require("../BaseController");
var PageHelper = require("../PageHelper");
module.exports = function (App, method) {
    var collection = "Domains";
    var property = "users";
    var returnProp = "domain";
    
    return controller(App,
            //Write Method
            function(obj,dWrite) {
            
                //Grab pageId
                var userRef = {
                    _id : obj.user,
                    date : new Date()
                };
                var pageId = parseInt(obj.page,10);
                var domainId = obj.domain;
                var updateObj;
                updateObj[property] = userRef;
                
                dWrite(
                    collection,
                    {_id: obj.domain, users : { "$not" : { "$elemMatch" : { _id : obj.user } } } },
                    { $addToSet : updateObj },
                    returnProp
                );
            },
            //Validation Method
            {
                before : function(obj, cb) {
                            var valid = typeof(obj.page) !== "undefined"
                                        && typeof(obj.user) !== "undefined";
                            if(valid) {
                                PageHelper(App,
                                    {_id: obj.page, users : { "$not" : { "$elemMatch" : { _id : obj.user } } } },                                                    //Query
                                    {$addToSet : { users : { _id : obj.user, date : new Date() } } },     //Update
                                    cb                                                                  //Callback
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

