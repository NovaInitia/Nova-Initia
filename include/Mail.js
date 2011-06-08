
module.exports = function(App) {
	var mail = {};
	mail.send = function(msg) {
	       	return App.$.Deferred(function(dfd) {
        	       	if(validateParams(msg)) {
                	       	msg.date = new Date();
	                        msg._id = msg.date.getTime();

       	                	new App.mongodb.Db(App.db.name,App.DataServer,{}).open(function (error,client) {
	               	                if(error) throw error;
                        	        var Users = new App.mongodb.Collection(client, 'Users');
               	                	Users.update(
           	    	                	{_id : msg.to},
	                       	                {$addToSet : { mail : msg}},
        	                       	        function(err) {
                                        	        if(err) dfd.reject(err);
                       	                        	else dfd.resolve();
	                               	        }
					);
				});
			}
		}).promise();
	};

	function validateParams(msg) {
        	var valid = true;
	        //valid = (typeof(msg.to) !== "undefined");
	        //valid = (typeof(msg.from) !== "undefined");
	        //valid = (typeof(msg.sub) !== "undefined" && msg.sub !== "");
	        //	valid = (typeof(msg.body) !== "undefined" && msg.body !== "");
	        return valid;
	}

	return mail;
};

