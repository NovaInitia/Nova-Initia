var App = {};
App = require('./config.js');
var $ = App.$;
var Public = {};
Public.mail = require('./include/Mail')(App);
Public.spiders = require('./include/Spiders')(App);

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
                        //Log(apiRequestParams, "apiRequestParams");
                        //Log(Public.spiders, "Public");
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
    if(error) throw error;
    App.db.client = client;
    App.Server = App.http.createServer(function(request,response) {
        //Log(request, "Request");
        request.setEncoding("utf8");
        request.content = "";
        request.addListener("data", function(data) {
            //Log(data,"Data Recieved");
            this.content += data;
        });
        request.addListener("end", function() {
            connectionHandler.apply(this).then(function() {
                //console.log(App.util.inspect(request));
                response.statusCode = 200;
                response.setHeader("Content-Type", "application/json");
                response.end(JSON.stringify(request.response));
            });
        });
    }).listen(App.web.port);
});