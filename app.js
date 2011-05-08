var NI = require('./config.js');

$ = require('jquery');

//Models
	
	//Init
	var mongoose = require('mongoose');
	var mongooseTypes = require('mongoose-types');
	mongooseTypes.loadTypes(mongoose);

	//References
	mongoose = require('./models/ClassModel')(mongoose);
	mongoose = require('./models/UserModel')(mongoose);


//End Models

var db = mongoose.connect(NI.db.host,NI.db.name,NI.db.port);

//Controllers

	//Init
	var express = require('express');
	var app = express.createServer();

	//References
	app = require('./controllers/UserController.js')(app, db, mongoose);
	
//End Controllers

app.listen(3001);

