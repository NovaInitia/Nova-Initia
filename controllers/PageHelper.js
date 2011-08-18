module.exports = function (App, query, update, cb) {
    var collection = "Pages"
    var Coll = new App.mongodb.Collection(App.db.client, collection);
    Coll.findAndModify(
        query,                                                          //Criteria
        [],                                                             //Sort
        update,                                                         //Update
        { new : true, upsert : true },                                  //Options
        function(err, modified) {                                       //Callback
            if(err) {                                                   //Error (Needs more work)
                if(err.message)
                {
                    if(err.message == "No matching object found") {
                        cb({ error : "no_update" });
                    } else {
                        cb({ error : err });
                    }
                }
            } else {                                                    //Success
                cb({ data : { page : modified } });
            }
        }
    );
};