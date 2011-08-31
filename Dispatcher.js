var EventEmitter = require('events').EventEmitter;
var util = require('util');

module.exports = function(App) {
    var observers = {
        put : {
            mail : require('./controllers/put/Mail')(App),
            spiders : require('./controllers/put/Spiders')(App),
            traps : require('./controllers/put/Traps')(App),
            barrels : require('./controllers/put/Barrels')(App),
            doorways : require('./controllers/put/Doorways')(App),
            signposts : require('./controllers/put/Signposts')(App),
            location : require('./controllers/put/Location')(App)
        }
    };
    

    var Dispatcher = new EventEmitter();
    Dispatcher.on("put", function(obj, conn) {
        var propNames = [];
        if(obj) {
            for(prop in obj) {
                propNames.push(prop);
            }
        }
        if(observers.put[propNames[0]]) {
           observers.put[propNames[0]](obj[propNames[0]]).then(function(resultData) {
               conn.sendUTF(JSON.stringify(resultData));
           },function(errData) {
               conn.sendUTF(JSON.stringify(errData));
           });
        }
     });
    return { dispatcher : Dispatcher, observers: observers };
}
            
            
        