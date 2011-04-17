var NI = require('./config.js'); 

//Controllers

	//Init
	var express = require('express');
	var app = express.createServer();

	//References
	app = require('./controllers/UserController.js')(app, db, mongoose);
	
//End Controllers

app.listen(3000);

