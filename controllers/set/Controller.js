module.exports = function (App, write, validate) {
    var service = {};    
    service.send = function (opts) {
            return App.$.Deferred(function(dSend) {
                validate.before(opts, function(results) {
                    if(!results.error) {
                        if(results.data == null) {
                            results.data = {}; 
                        }
                        write(opts, function(collectionName, collectionId, objName, opts) {
                            var updateObject = {};
                            updateObject[objName] = opts;
                            var Coll = new App.mongodb.Collection(App.db.client, collectionName);
                            Coll.findAndModify(
                                {_id: collectionId},                                                //Criteria
                                [],                                                                 //Sort
                                {$addToSet: updateObject },                                         //Update
                                { new : true },                                                     //Options
                                function(err, modified) {                                           //Callback
                                    if(err) {                                                       //Error (Needs more work)
                                        dSend.resolve(err);
                                    } else {                                                        //Success
                                        results.data.page = modified;
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

//Get Collection
