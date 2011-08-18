var controller = require('../BaseController');

module.exports = function (App) {
    var collection = "Pages";
    var property = "doorways";
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
                        var valid = (
                            typeof(obj.to) !== "undefined"
                            && typeof(obj.from) !== "undefined"
                            && typeof(obj.url) !== "undefined"
                        );
                        if(valid) {
                            var Users = new App.mongodb.Collection(App.db.client, "Users");
                            Users.findAndModify(
                                {_id: obj.from, doorways : { "$gt" : 0 }},                       //Criteria
                                [],                                                             //Sort
                                { $inc : { doorways : -1 } },                                     //Update
                                { new : true},                                                  //Options
                                function(err, modified) {                                       //Callback
                                    if(err) {                                                   //Error (Needs more work)
                                        cb({ error : err });
                                    } else {                                                    //Success
                                        App.db.client.dereference(modified.class, function(err, results) {
                                            if(!err) {
                                                modified.class = results;
                                            }
                                            cb({ data : { user : modified } });
                                        });
                                    }
                                }
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