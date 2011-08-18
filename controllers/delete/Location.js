var controller = require("../BaseController");
var PageHelper = require("../PageHelper");
module.exports = function (App) {
    var property = "users";
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
                        
                        dWrite(
                            "Domains",
                            {_id: obj.domain, users : { "$elemMatch" : { _id : obj.user } } },
                            { $pull : { users : { _id : obj.user } } },
                            "domain"
                        );
                    },
                    //Validation Method
                    {
                        before : function(obj, cb) {
                                    var valid = typeof(obj.page) !== "undefined"
                                                && typeof(obj.user) !== "undefined";
                                    if(valid) {
                                        PageHelper(App,
                                            {_id: obj.page, users : { "$elemMatch" : { _id : obj.user } } },                                                   //Query
                                            { $pull : { users : { _id : obj.user } } },                          //Update
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