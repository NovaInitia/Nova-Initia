//Settings


module.exports = {
    
    debug : false,
    
    web : {
        port : 3000,
        response : {
             gzip : false
        }
    },
    
    db : {
        name : 'ni',
        host : '127.0.0.1',
        port : 27017
    },
    
    user : {
        route : '/user/',
        id : ':val',
        auth : 'profile'
    },  
    
    util : require('util'),
    
    through : function(d,cb){cb(null,d);}
    
};