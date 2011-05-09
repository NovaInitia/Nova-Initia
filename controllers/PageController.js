var async = require('async');
var NI = require('../config.js');
var util = NI.util;
var base = require('./BaseController'),
    sendData = base.sendData;


module.exports = function($, app, db, mongo) {

	var Db = mongo.Db, Connection = mongo.Connection, Collection = mongo.Collection, Server = mongo.Server, BSON = mongo.BSONNative;

	var mdb = new Db(NI.db.name, new Server(NI.db.host, NI.db.port, {auto_reconnect : true}), {native_parser:true});
	
	var root = NI.page;
    
    function getPageById(req,res) {
        
        function visitPage(coll, callback) {
            var pageId = parseInt(req.params.val);
            coll.findOne(
                {"_id": pageId},
                pageSet,
                function(err, data) {
                    callback(err, data);
                }
            );
            coll.update(
                {"_id": pageId, "traps" : { "$ne" : [] , "$exists" : true } },
                { "$pop" : { traps : -1 } },
                { "safe" : true },
                function(err) {
                    //if(err)
                        //console.log(err);
                }
            );
        }
                                       
        async.waterfall([
                checkDB,
                setCollection,
                visitPage
            ],
            function(err, resObj) {
                sendData(err, res, resObj);
            }
        );
    }
    
    function checkDB(callback) {
        if(mdb.state != 'connected') {
            mdb.open(callback);
        } else {
            callback(null, mdb);
        }
    }
    
    function setCollection(db, callback) {
        mdb.collection('Pages', callback);
    }
    
    if(app && db) {

	//View Models

	var pageSet = {
		fields : {
			fake : 1,
			traps : { "$slice" : 1 },
			doorways : { "$slice" : 10 },
			barrels : { "$slice" : 1 },
			signposts : { "$slice" : 1 }
		}
	};

	//Routes

	// /page/:id
	app.get(root.route+root.id, getPageById);        
        
	//End Routes

    }

    
	return app;
};


