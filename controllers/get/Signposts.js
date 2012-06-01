var controller = require("./Controller");

module.exports = function (App) {
    var collection = "Signposts";
    var returnProp = "signposts";
    
    return controller(App,
        //Read Method
        function(obj,dRead) {
        
            //Grab username
            var userId = obj.user;
        
            dRead(
                collection,
                {"user": userId},
                returnProp
            );
        },
        //Validation Method
        {
            before : function(obj, cb) {
                        var valid = typeof(obj.user) !== "undefined";
                        if(valid) {
                            cb({});
                        } else {
                            cb({ error : "invalid_params" });
                        }
            },
            after : function(obj) {
            }
        }
    );
};

