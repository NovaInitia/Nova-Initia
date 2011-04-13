var _dbName = 'ni',
    _dbAddress = '127.0.0.1',
    _dbPort = 27017;

$ = require('jquery')

var util = require('util');

//Models
	
	//Init
	var mongoose = require('mongoose');
	var mongooseTypes = require('mongoose-types');
	mongooseTypes.loadTypes(mongoose);

	//References
	mongoose = require('./models/ClassModel')(mongoose);
	mongoose = require('./models/UserModel')(mongoose);


//End Models

var db = mongoose.connect(_dbAddress,_dbName,_dbPort);

//Controllers

	//Init
	var express = require('express');
	var app = express.createServer();

	//References
	app = require('./controllers/UserController.js')(app, db, mongoose);
	
//End Controllers

app.listen(3000);

