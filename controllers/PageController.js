var NI = require('../config.js');
var util = NI.util;
var base = require('./BaseController'),
    sendData = base.sendData;


module.exports = function(app, db, mongoose) {

    var root = NI.page;

	if(app && db && mongoose) {

	//Models

		var Pages = db.model('Page', 'Pages');


    //Helpers
        var findPageByProp = function(prop, val, callback) {
            switch(prop) {
                
                case "hash":
                    Pages.findOne({"hash":val}, {}, function(err, doc) {
                        if(!err) {
                            //resolveChildren(doc,callback);
                            callback(doc);
                        } else {
                            callback(err);
                        }
                    });
                    break;

                case "id":
                    Pages.findOne({"_id":val}, {}, function(err, doc) {
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



        var resolveChildren = function(doc, cb) {
            var Domains = db.model('Domain','Domains');
            Domains.findOne({"hash" : doc.doc.domain},{},function(err, dObj) {
                if(dObj)
                    doc.doc.domain = dObj;
                cb(doc);
            });
        };

        
    //End Helpers


    //Routes
    

		// Get
		app.get(root.route+root.id, function(req, res) {
			findPageByProp("hash", req.params.val, function(obj) {
                sendData(res, JSON.stringify(obj));
			});
		});
        
        
        

	//End Routes


    }
	return app;
};


