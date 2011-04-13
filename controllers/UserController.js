var NI = require('../config.js');
var util = NI.util;
var base = require('./BaseController'),
	sendData = base.sendData;


module.exports = function(app, db, mongoose) {

    var root = NI.user;

	if(app && db && mongoose) {

	//Models

		var Users = db.model('User', 'Users');


    //Helpers
        var findUserByProp = function(prop, val, callback) {
        
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

                case "key":
                    Users.findOne({"key":val}, {}, function(err, doc) {
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
        };
        
        
        var removePrivateData = function(obj) {
            delete obj.doc.armor;
            delete obj.doc.key;
            delete obj.doc.karma;
            delete obj.doc.pass;
            delete obj.doc.sg;
            delete obj.doc.ldate;
            delete obj.doc.traps;
            delete obj.doc.barrels;
            delete obj.doc.spiders;
            delete obj.doc.shields;
            delete obj.doc.doorways;
            delete obj.doc.signposts;
            delete obj.doc.email;
            delete obj.doc.first;
            delete obj.doc.last;
            return obj;
        };

        
    //End Helpers


    //Routes
    
        // Get Authorized User
        app.get(root.route+root.auth, function(req, res) {
            if(req.header('LastKey')) {
                findUserByProp("key", req.header('LastKey'), function(obj) {
                    sendData(res, JSON.stringify(obj));
                });
            }
        });

        app.get(root.route+'toggle', function(req, res) {
            if(req.header('LastKey')) {
                console.log("Toggle");
                findUserByProp("key", req.header('LastKey'), function(obj) {
                    obj.set('toggleShield',null);
                });
            }
        });

		// Get User By Username
		app.get(root.route+root.id, function(req, res) {
			findUserByProp("id", req.params.val, function(obj) {
                if(obj !== null) {
                    obj = removePrivateData(obj);
                } else {
                    console.log("No User Found");
                }
				sendData(res, JSON.stringify(obj));
			});
		});
        
        
        

	//End Routes


    }
	return app;
};


