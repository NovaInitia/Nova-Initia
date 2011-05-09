var NI = require('./config.js');
$ = require('jquery');
var util = require('util');
var mongoose = require('mongoose');
var mongooseTypes = require('mongoose-types');
mongooseTypes.loadTypes(mongoose);
var mongo = require('mongodb');

//Models


        //References
        mongoose = require('./models/ClassModel')(mongoose);
        mongoose = require('./models/UserModel')(mongoose);
        mongoose = require('./models/DomainModel')(mongoose);
        mongoose = require('./models/PageModel')(mongoose);
        mongoose = require('./models/ToolModel')(mongoose);
        mongoose = require('./models/MessageModel')(mongoose);

//End Models

var db = mongoose.connect(NI.db.host, NI.db.name, NI.db.port);

//Controllers

        //Init
        var express = require('express');
        var app = express.createServer();
        app.use(express.cookieParser());

        //References
        app = require('./controllers/UserController.js')($, app, db, mongoose);
        app = require('./controllers/PageController.js')($, app, db, mongo);

//End Controllers

app.listen(NI.web.port);
