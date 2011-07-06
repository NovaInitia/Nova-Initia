module.exports = function (App) {
    var service = {};    
	service.send = function (opts) {
            return App.$.Deferred(function(dSend) {
                    if(validateParams(opts)) {
                            //Grab pageId
                            var pageId = opts.to;
                            
                            //Arrange properties for write to Db
                            delete opts.to;
                            opts.date = new Date();
	                        opts._id = opts.date.getTime();
                            
                            //Get Collection
                            var Pages = new App.mongodb.Collection(App.db.client, 'Pages');
                            Pages.findAndModify(
                                {_id: parseInt(pageId)},        //Criteria
                                [],                             //Sort
                                {$addToSet: {spiders: opts}},   //Update
                                {},                             //Options
                                function(err, modified) {       //Callback
                                    if(err) {                   //Error (Needs more work)
                                        dSend.reject(err);
                                    } 
                                    else {                      //Success
                                        dSend.resolve(modified);//Returns the Page object modified, this should be changed.
                                    }
                                }
                            );
			        }
		        }).promise();
	};

	function validateParams(opts) {
	        //valid = (typeof(opts.sub) !== "undefined" && opts.sub !== "");
	        //	valid = (typeof(opts.body) !== "undefined" && opts.body !== "");
	        return typeof(opts.to) !== "undefined" && typeof(opts.from) !== "undefined";
	}

	return service;
};

