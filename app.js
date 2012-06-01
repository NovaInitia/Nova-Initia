var App = {};
App = require('./config.js');
var openid = require('openid');
var url = require('url');
var querystring = require('querystring');
var relyingParty = new openid.RelyingParty(
    'http://dev2.nova-initia.com:3080/verify', // Verification URL (yours)
    null, // Realm (optional, specifies realm for OpenID authentication)
    false, // Use stateless verification
    false, // Strict mode
    []); // List of extensions to enable and include

App.mongoose.models.base = {};
var $ = App.$;
var mongooseTypes = require("mongoose-types");

App.mongoose.connect("mongodb://"+App.db.host+"/"+App.db.name);

mongooseTypes.loadTypes(App.mongoose);

App.mongoose = require('./models/BarrelModel.js')(App.mongoose);
App.mongoose = require('./models/ClassModel.js')(App.mongoose);
App.mongoose = require('./models/DomainModel.js')(App.mongoose);
App.mongoose = require('./models/DoorwayModel.js')(App.mongoose);
App.mongoose = require('./models/MessageModel.js')(App.mongoose);
App.mongoose = require('./models/PageModel.js')(App.mongoose);
App.mongoose = require('./models/SignpostModel.js')(App.mongoose);
App.mongoose = require('./models/SpiderModel.js')(App.mongoose);
App.mongoose = require('./models/ToolModel.js')(App.mongoose);
App.mongoose = require('./models/TrapModel.js')(App.mongoose);
App.mongoose = require('./models/UserModel.js')(App.mongoose);


var server = App.express.createServer();
server.use(App.express.logger());
server.use(App.express.bodyParser());
server.use(App.express.cookieParser());
server.use(server.router);
var validKeys = [];

server.get('/auth', function(req, res) {
    var lastkey = randomString(64);
    validKeys.push(lastkey);
    res.send(lastkey);
});


server.post('/login', function(req, res) {
	var data;
	var UserModel = App.mongoose.model('User');
	if(req.body) {
		data = req.body;
		if(data && typeof(data.lastkey)!='undefined') {
			if(validKeys.indexOf(data.lastkey)>-1) {
				validKeys.splice(validKeys.indexOf(data.lastkey),1);
				UserModel.findOne({"_id":data.user,"pass":data.pass}, function(err, doc) {
					var newKey = randomString(64);
					doc.key = data.lastkey = newKey;
					doc.save();
					res.send(newKey);
				});
			}
		} else {
			data = {};
			data.lastkey = '';
			res.send(data.lastkey);
		}
	}
});



server.get('/signposts/:id', function (req, res) {
	var signpostId = req.params.id;
	var SignpostModel = App.mongoose.model('Signpost');
	SignpostModel.findOne({'_id' : signpostId},function(err, docs) {
		res.send(docs);
	});
});

server.get('/signposts', function (req, res) {
    var SignpostModel = App.mongoose.model('Signpost');
    SignpostModel.find({},function(err, docs) {
        res.send(docs);
    });
});


server.put('/signposts', function (req, res) {
    var SignpostModel = App.mongoose.model('Signpost');
    var newSignpost = new SignpostModel(req.body);
    res.send(newSignpost.save());
});

server.get('/users', function (req, res) {
    var UserModel = App.mongoose.model('User');
    UserModel.find({},function(err, docs) {
        res.send(docs);
    });
});

server.get('/users/:id', function (req, res) {
    var userId = req.params.id;
    var UserModel = App.mongoose.model('User');
    UserModel.findOne({'_id' : userId },function(err, docs) {
        res.send(docs);
    });
});

server.get('/users/:id/toggleShield', function (req, res) {
    var userId = req.params.id;
    var UserModel = App.mongoose.model('User');
    UserModel.findOne({'_id' : userId },function(err, docs) {
        foundUser = new UserModel(docs);
        foundUser.set("toogleShield","");
        console.log(JSON.stringify(foundUser));
        res.send(foundUser);
    });
});


server.listen(App.web.port);

var randomString = function (bits) {
  var chars, rand, i, ret;
  
  chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'; 
  ret = '';
  
  // in v8, Math.random() yields 32 pseudo-random bits (in spidermonkey it gives 53)
  while (bits > 0) {
    // 32-bit integer
    rand = Math.floor(Math.random() * 0x100000000); 
    // base 64 means 6 bits per character, so we use the top 30 bits from rand to give 30/6=5 characters.
    for (i = 26; i > 0 && bits > 0; i -= 6, bits -= 6) {
      ret += chars[0x3F & rand >>> i];
    }
  }
  
  return ret;
};
