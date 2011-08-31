module.exports = function (App, write, validate) {
    var service = function (opts) {
            return new App.$.Deferred(function(dSend) {
                validate.before(opts, function(results) {
                    if(!results.error) {
                        if(results.data === null || results.data == undefined) {
                            results.data = {}; 
                        }
                        write(opts, function(collectionName, query, resultsProp) {
                            var Coll = new App.mongodb.Collection(App.db.client, collectionName);
                            Coll.findOne(
                                query,                                                              //Criteria
                                {},                                                                 //Options
                                function(err, qResult) {                                            //Callback
                                    if(err) {                                                       //Error (Needs more work)
                                        dSend.resolve(err);
                                    } else {                                                        //Success
                                        results.data[resultsProp] = qResult;
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