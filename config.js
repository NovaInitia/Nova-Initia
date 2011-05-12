//Settings

var I = Infinity;
module.exports = {
    debug : false,
    
    web : {
        port : process.env.NIPORT,
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

    tools: {    //Note: I = Infinity.
        traps: {
            cost: [3,1,3,3],
            rate: [1,1,1,1],                //Number of traps given per unit bought.
            failChance: [0.05, 0.05, 0.05, 0.05],   //Needs work.
            experience: [{age: 0, xp: 5}    //See spiders.experience
            ],
            initialXP: 5, //XP given when the trap is set.
            baseDMG: [{age: 0, dmg: [10,10,10,10]}, //Damage a trap causes depending on the class of the player who set it.
                      {age: 7*24*60*60*1000, dmg: [15,15,15,15]},
                      {age: 30*24*60*60*1000, dmg: [15,15,15,15]},
                      {age: 90*24*60*60*1000, dmg: [25,25,25,25]},
                      {age: 150*24*60*60*1000, dmg: [50,50,50,50]}
            ],
            expertTraps: [{karma: 95, age: 0, addedDMG: 5, addedEXP: 0}, //Karma must be between 0 and 100. 0 = all traps.
                          {karma: 95, age: 90*24*60*60*1000, addedDMG: 10, addedEXP: 0}  //Users must have at most <karma> to recieve the benefits.
            ],
            anonymousTrapLV: [0,10,0,0],
            anonymousTrapCost: [0,0,0,0]
            
        },
        barrels: {
            cost: [3,1,3,3],                //Cost to buy a barrel from the shop.
            rate: [1,1,1,1],                //Number of barrels given per unit bought.
            experience: [{age: 0, xp: 5},  //Age is in milliseconds.
                         {age: 7*24*60*60*1000, xp: 10},
                         {age: 30*24*60*60*1000, xp: 10},
                         {age: 90*24*60*60*1000, xp: 25},
                         {age: 150*24*60*60*1000, xp: 50}
            ],
            initalXP: 5,
            fullnessBonus: 5,   //Value is multiplied by the percentage of space the player filled in the barrel and rounded down. A maxed barrel will yield full XP.
            reuseChance: [],  //Chance a barrel can be reused, depending on the class of the player that first set it.
            reuseNum: 3,    //The max number of times players can visit a URL.
            internalMessageLV: [1,1,1,1],   //Level a player must be to leave an internal message in a barrel.
            externalMessageLV: [0,5,0,0],   //Level a player must be to attach an external message to a barrel.
            messageLength: {internalMessage: 155,
                            externalMessage: 128
            },
            messageAllowHTML: [0,0,0,0],    //Level a player must be if they wish to add HTML to their barrel messages.
            toolCapacity: [10,100,10,10],   //Number of tools a player can put in a barrel. 10 Sg = 1 Tool.
            stashSgLV: [0,1,0,0],           //Level each class must be in order to place Sg in a barrel.
            lootOwnBarrelLV: [0,15,0,0]     //Level at which a player may loot a barrel he left.
        },
        spiders: {
            cost: [0,0,0,0],
            rate: [0,0,0,0],    //Number of Spiders given per unit bought.
            experience: [{age: 0, xp: 5},  //Age is in milliseconds.
                         {age: 7*24*60*60*1000, xp: 10},
                         {age: 30*24*60*60*1000, xp: 15},
                         {age: 90*24*60*60*1000, xp: 25},
                         {age: 150*24*60*60*1000, xp: 50}
            ],
            initialXP: 5,
            baseDMG: [{age: 0, dmg: [10,10,10,10]}  //Dmg based on class that placed Spider.
            ],
            crowdingSpiderPlaced: 0,
            crowdingSpiderTripped: 0,
            wanderingSpiderLV: [0,0,15,0],
            antiSignPostSpiderLV: [0,0,10,0]
        },
        shields: {
            cost: [3,3,1,3],
            rate: [1,1,1,1],                //Number of shields given per unit bought.
            maxHits: [1,1,3,1]
        },
        doorways: {
            cost: [3,3,3,1],
            rate: [1,1,1,1],                //Number of doorways given per unit bought.
            experience: {giver: {giver: 0, guardian: 0, guide: 0},  //Syntax: <owner class>.<user class>
                         guardian: {giver: 0, guardian: 0, guide: 0},
                         guide: {giver: 5, guardian: 5, guide: 5}
            },
            initialXP: {giver: 10, guardian: 10, guide: 10},
            transportBarrel: {giver: {base: 0.08, subtract: 0.002}, //Base is the base %. Subtract is multiplied
                              guardian: {base: 0.08, subtract: 0.002},  // by the players LV and subtracted from
                              guide: {base: 0.08, subtract: 0.002}      //the base to from the actual %.
            },
            charges: {giver: [{level: 0, charge: 50},   //The level required for each charge amount
                              {level: 15, charge: 100}  //for each class.
                      ],
                      guardian: [{level: 0, charge: 50}
                      ],
                      guide: [{level: 0, charge: 50}
                      ]
            },
            chainOwn: {giver: I, guardian: I, guide: 0},
            chainOther: {},
            passThrough: {giver: 1, guardian: 1, guide: 1},
            ownerPassThrough: {giver: 3, guardian: 3, guide: 3},
            forceDoorway: {giver: [{level: 0, chance: 0.01}], //Calculates based on the class and level of the player who set the doorway.
                           guardian: [{level: 0, chance: 0.01}],
                           guide: [{level: 0, chance: 0.03}]
            },
            pageLimits: {giver: {own: 5, total: 200},
                         guardian: {own: 5, total: 200},
                         guide: {own: 200, total: 200}
            }
            
        },
        signposts: {
            cost: [3,3,3,1],
            rate: [1,1,1,1],                //Number of signposts given per unit bought.
            experience: 10,
            initialXP: 0,
            
            branches: {giver: [{level: 0, branches: 1}
                       ],
                       guardian: [{level: 0, branches: 1}
                       ],
                       guide: [{level: 0, branches: 1},
                               {level: 8, branches: 2},
                               {level: 12, branches: 3},
                               {level: 20, branches: 2},
                       ]
            }
        }
    }
};
