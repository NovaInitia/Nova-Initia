var controller = require("./Controller");

module.exports = function (App) {
    var collection = "Users";
    var returnProp = "user";
    
    return controller(App,
        //Read Method
        function(obj,dRead) {
        
                //Grab userId
                var userId = parseInt(obj.id,10);
            
                dRead(
                    collection,
                    {_id: userId },
                    returnProp
                );
        },
        //Validation Method
        {
            before : function(obj, cb) {
                        var valid = typeof(obj.id) !== "undefined";
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
