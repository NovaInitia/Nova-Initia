//Controller Template
var util = require('util');
var base = require('./BaseController'),
	sendData = base.sendData;

module.exports = function(app, db, mongoose) {

	var reqRoot = '/user/';

	if(app && db && mongoose) {

	//Models

		var Users = db.model('User', 'Users');

	//Routes

		
		app.get(reqRoot+':val', function(req, res) {
			findUserByProp("id", req.params.val, function(obj) {
				sendData(res, JSON.stringify(obj));
			});
		});

	//End Routes

	//Helpers

		function findUserByProp(prop, val, callback) {
			switch(prop) {
				case "id":
		        		Users.findOne({"_id":val}, {}, function(err, doc) {
						if(!err) {
							callback(doc);
						} else {
							callback(err);
						}
					});
					break;
				default:
					callback({});
			}


		}

	//End Helpers

	}
	return app;
};
