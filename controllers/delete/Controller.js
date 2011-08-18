module.exports = function (App, write, validate) {
    var service = {};
    service.remove = function (opts) {
            return new App.$.Deferred(function(dSend) {
                validate.before(opts, function(results) {
                    if(!results.error) {
                        if(results.data === null) {
                            results.data = {}; 
                        }
                        write(opts, function(collectionName, query, update, resultsProp) {
                            var updateObject = {};
                            var Coll = new App.mongodb.Collection(App.db.client, collectionName);
                            Coll.findAndModify(
                                query,                                                              //Criteria
                                [],                                                                 //Sort
                                update,                                                             //Update
                                { new : true },                                                     //Options
                                function(err, modified) {                                           //Callback
                                    if(err) {                                                       //Error (Needs more work)
                                        dSend.resolve(err);
                                    } else {                                                        //Success
                                        results.data[resultsProp] = modified;
                                        dSend.resolve(results.data);
                                    }
                                }
                            );
                        });
                    } else {
                        dSend.resolve(results);
                    }
                });
            }).promise();
	};
    
    return service;
};