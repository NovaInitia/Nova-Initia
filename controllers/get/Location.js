var controller = require("./Controller");

module.exports = function (App) {
    var collection = "Pages";
    var returnProp = "page";
    
    return controller(App,
            //Read Method
            function(obj,dRead) {
            
                //Grab pageId
                var pageId = parseInt(obj.id,10);
            
                dRead(
                    collection,
                    {_id: pageId },
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

