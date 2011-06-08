var App = {};
App = require('./config.js');
var $ = App.$;

App.DataServer= new App.mongodb.Server(App.db.host,App.db.port, {});

var Public = {};
Public.mail = require('./include/Mail')(App);

new App.mongodb.Db(App.db.name,App.DataServer,{}).open(function (error,client) {
    if(error) throw error;
    App.db.client = client;
    App.Server = App.http.createServer(function(request,response) {
    	request.setEncoding("utf8");
    	request.content = "";
    	request.addListener("data", function(data) {
    		request.content += data;
    	});
    	request.addListener("end", function() {
    		var connectionHandler = $.Deferred(function(con) {
    			var respSet = [];
    			var reqObj = JSON.parse(request.content);
    			for(var obj in reqObj) {
    				for(var method in reqObj[obj]) {
    					respSet.push($.Deferred(function(dfd) {
    						dfd.resolve(Public[obj][method](reqObj[obj][method]));
    					}));
    				}
    			}
    			$.whenArray(respSet).then(function(){
    				var sendSet = {};
    				for(var param in arguments) {	
    					$.extend(sendSet, arguments[param]);
    				}
    				if(sendSet == {})
    					con.resolve();
    				else
    					con.resolve(sendSet);
    			});
    		}).then(function(resp) {
    			response.statusCode = 200;
    			response.setHeader("Content-Type", "application/json");
    			response.write(JSON.stringify(resp));
    			response.end();
    		});
    	});
    }).listen(App.web.port);
});

