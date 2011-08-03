module.exports = function (App, write, validate) {
    var service = {};    
    service.send = function (opts) {
            return App.$.Deferred(function(dSend) {
                    if(validate(opts)) {
                        write(opts, function(collectionName, collectionId, objName, opts) {
                            var updateObject = {};
                            updateObject[objName] = opts;
                            var Coll = new App.mongodb.Collection(App.db.client, collectionName);
                            Coll.findAndModify(
                                {_id: collectionId},                  //Criteria
                                [],                             //Sort
                                {$addToSet: updateObject },   //Update
                                {},                             //Options
                                function(err, modified) {       //Callback
                                    if(err) {                   //Error (Needs more work)
                                        dSend.reject(err);
                                    } else {                      //Success
                                        dSend.resolve(modified);//Returns the Page object modified, this should be changed.
                                    }
                                }
                            );
                        });
			        }
		        }).promise();
	};
	return service;
};

//Get Collection
