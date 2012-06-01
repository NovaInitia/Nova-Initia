module.exports = function (App, write, validate) {
    var service = function (opts) {
            return new App.$.Deferred(function(dSend) {
                validate.before(opts, function(results) {
                    if(!results.error) {
                        if(results.data === null || results.data === undefined) {
                            results.data = {}; 
                        }
                        write(opts, function(collectionName, query, resultsProp) {
                            App.db.client.collection(collectionName, function(err, Coll){
                                Coll.find(
                                    query,                                                              //Criteria
                                    function(err, qResult) {
                                        App.util.inspect(qResult); //Callback
                                        if(err) {                                                       //Error (Needs more work)
                                            dSend.resolve(err);
                                        } else {                                                        //Success
                                            results.data[resultsProp] = [];
                                            qResult.toArray(function(err, obj) {
                                                results.data[resultsProp].push(obj);    
                                            });
                                            dSend.resolve(results.data);
                                        }
                                    }
                                )
                            });
                        });
                    } else {
                        dSend.resolve(results);
                    }
                });
	        }).promise();
	};
    
	return service;
};