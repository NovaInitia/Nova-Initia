var WebSocketServer = require("WebSocket-Node").server;
var events = require('events');

var App = {};
App = require('./config.js');
var $ = App.$;
//delete : require('./controllers/delete/Location')(App)
//Public.location.get = require('./controllers/get/Location')(App);
var Router = require('./Dispatcher')(App);
App.DataServer= new App.mongodb.Server(App.db.host,App.db.port, {});

function Log(msgs, name) {
    console.log("-"+name+"-");
    function writeToConsole(msg) {
        console.log(msg);
        App.util.inspect(msg);
    }
    if(App.debug) {
        if(Array.isArray(msgs))
        {
            msgs.forEach(writeToConsole);
        } else {
            writeToConsole(msgs);
        }
    }
    console.log("-/"+name+"-");
}

function connectionHandler() {
    var request = this;
    var apiRequest = JSON.parse(request.content);
    Log(apiRequest, "apiRequest");
    return $.Deferred(function(dConnection){
        var dResponses = [];
        $.map(apiRequest, function(service, serviceName) {
            $.map(service, function(method, methodName) {
                Log(method, serviceName+":"+methodName);
                dResponses.push(
                    $.Deferred(function(dApiRequest) {
                        var apiRequestParams = method;
                        Log(apiRequestParams, "apiRequestParams");
                        Router.observers[serviceName][methodName](apiRequestParams).then(function(apiResults) {
                            Log(apiResults, "apiResults");
                            dApiRequest.resolve(apiResults);
                        });
                    }).promise()
                );
            });
        });
        $.when.apply(this,dResponses).then(function(){
            Log(arguments, "when:responseData");
            request.response = {};
            if(arguments) {
                $.each(arguments, function(i,obj) {
                    $.extend(request.response, obj);
                });
            }
            //request.response = sendSet;
            dConnection.resolve();
        });
    }).promise();
}

new App.mongodb.Db(App.db.name,App.DataServer,{}).open(function (error,client) {
    console.log("DB Open");
    if(error) {
        console.log("DB Error");
        throw error;
    }
    App.db.client = client;
    console.log("Create Server");
    
    
    var server = App.http.createServer(function(req, res) {
        req.addListener('data',function(data) {
            Log(data,"Data Recieved");
            this.content += data;
        });
        Log(req, "Request");
        req.setEncoding("utf8");
        req.content = "";
        
        req.addListener("end", function() {
            connectionHandler.apply(this).then(function() {
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(req.response));
            });
        });
    });
    server.listen(App.web.port,App.web.host, function(){ console.log("Server Started");});
    
    var wsServer = new WebSocketServer({
        httpServer: server,
        autoAcceptConnections: true
    });

    wsServer.on('connect', function(connection) {
        console.log((new Date()) + " Connection accepted.");
        connection.on('message', function(message) {
            if (message.type === 'utf8') {
                var obj = JSON.parse(message.utf8Data);
                if(obj) {
                    for(prop in obj) {
                        Router.dispatcher.emit(prop,obj[prop],connection);
                    }
                }
            }
            else if (message.type === 'binary') {
                console.log("Received Binary Message of " + message.binaryData.length + " bytes");
                connection.sendBytes(message.binaryData);
            }

        });
        connection.on('close', function(connection) {
            console.log((new Date()) + " Peer " + connection.remoteAddress + " disconnected.");
        });
    });
    
});
