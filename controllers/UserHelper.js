module.exports = function (App, query, update, cb) {
    var collection = "Users"
    var Coll = new App.mongodb.Collection(App.db.client, collection);
    Coll.findAndModify(
        query,                                                          //Criteria
        [],                                                             //Sort
        update,                                                         //Update
        { new : true },                                                  //Options
        function(err, modified) {                                       //Callback
            if(err) {                                                   //Error (Needs more work)
                if(err.message)
                {
                    if(err.message == "No matching object found") {
                        cb({ error : "insufficient_inventory" });
                    } else {
                        cb({ error : err });
                    }
                }
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
};