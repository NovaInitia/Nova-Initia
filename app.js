var App = {};
App = require('./config.js');
var $ = App.$;
var Public = {};
Public.mail = require('./include/Mail')(App);
Public.spiders = require('./controllers/set/Spiders')(App);
Public.traps = require('./controllers/set/Traps')(App);
Public.barrels = require('./controllers/set/Barrels')(App);
Public.doorways = require('./controllers/set/Barrels')(App);

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
    console.log("Conn H Open");
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
                        Log(Public.spiders, "Public");
                        Public[serviceName][methodName](apiRequestParams).then(function(apiResults) {
                            Log(apiResults, "apiResults");
                            dApiRequest.resolve(apiResults);
                        });
                    }).promise()
                );
            });
        });
        $.when.apply(this,dResponses).then(function(){
            Log(arguments, "when:responseData");
            var sendSet = {};
            if(arguments) {
                //$.map(responseData, function(value, key) {
                    $.extend(sendSet, arguments);
                //})
            }
            request.response = sendSet;
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
    
    
    App.http.createServer(function(req, res) {
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
    }).listen(App.web.port,'127.0.0.1', function(){ console.log("Server Started");});
});