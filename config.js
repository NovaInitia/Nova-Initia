//Settings


module.exports = {
    
    debug : false,
    
    web : {
        port : 3083,
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
    
    page : {
        route : '/page/',
        id : ':val'
    },
    
    util : require('util'),
    
    through : function(d,cb){cb(null,d);},

    tools: {
     spiders: {
      experience: [{age: 0, value: 5},  //Age is in milliseconds, value is in XP.
                   {age: 7*24*60*60*1000, value: 10},
                   {age: 30*24*60*60*1000, value: 15},
                   {age: 90*24*60*60*1000, value: 25},
                   {age: 150*24*60*60*1000, value: 50}
      ]
    }
  }
};
