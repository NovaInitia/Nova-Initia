var controller = require('./Controller');
module.exports = function (App) {
    var collection = "Users";
    var property = "posts";
    return controller(App,
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
        {
            before : function(obj, cb) {
                        var valid = typeof(obj.url) !== "undefined" && typeof(obj.user) !== "undefined";
                        if(valid) {
                            var Users = new App.mongodb.Collection(App.db.client, "Users");
                            Users.findAndModify(
                                {_id: obj.from, signposts : { "$gt" : 0 }},                     //Criteria
                                [],                                                             //Sort
                                {$inc : { signposts : -1 } },                                     //Update
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
