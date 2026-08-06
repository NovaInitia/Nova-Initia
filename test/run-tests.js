//Tests for the JSON data layer and the routes app.js serves from it.
//Run with:  node test/run-tests.js

process.env.NI_DATA = 'json';

var http = require('http');
var path = require('path');
var App = require(path.join(__dirname, '..', 'config.js'));

var passed = 0, failed = 0;
var failures = [];

var check = function (name, actual, expected) {
    var a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) { ++passed; console.log('  ok   ' + name); }
    else {
        ++failed;
        failures.push(name + '\n         expected ' + e + '\n         actual   ' + a);
        console.log('  FAIL ' + name + '  expected ' + e + ', got ' + a);
    }
};

var ok = function (name, cond) { check(name, !!cond, true); };

var section = function (title) { console.log('\n' + title); };

//---------------------------------------------------------------------------
// Set up the store exactly as app.js does
//---------------------------------------------------------------------------

var mongoose = App.mongoose;
mongoose.models.base = {};
mongoose.connect('mongodb://' + App.db.host + '/' + App.db.name);

['Barrel', 'Class', 'Domain', 'Doorway', 'Message', 'Page', 'Signpost', 'Spider', 'Tool', 'Trap', 'User']
    .forEach(function (name) {
        mongoose = require(path.join(__dirname, '..', 'models', name + 'Model.js'))(mongoose);
    });

var User = mongoose.model('User');
var Signpost = mongoose.model('Signpost');
var Page = mongoose.model('Page');
var Trap = mongoose.model('Trap');
var Barrel = mongoose.model('Barrel');
var Domain = mongoose.model('Domain');

//---------------------------------------------------------------------------

section('Fixtures load');
check('four users seeded', User.find({}).length, 4);
check('four signposts seeded', Signpost.find({}).length, 4);
check('three pages seeded', Page.find({}).length, 3);
check('three traps seeded', Trap.find({}).length, 3);

section('Queries');
check('findOne by string _id', User.findOne({ _id: 'wanderer' })._id, 'wanderer');
check('findOne miss returns null', User.findOne({ _id: 'nobody' }), null);
check('numeric _id casts from string',
      Signpost.findOne({ _id: '1753790400000' }).user, 'festercluck');
check('numeric _id as number', Signpost.findOne({ _id: 1753790400000 }).user, 'festercluck');
check('multi-field match', User.findOne({ _id: 'novice', pass: 'firstday' })._id, 'novice');
check('wrong password does not match', User.findOne({ _id: 'novice', pass: 'wrong' }), null);
check('filter by class', Signpost.find({ 'class': 3 }).length, 2);
check('dotted path query', User.find({ 'stats.lvls.guide': 20 }).length, 1);

section('Query operators');
check('$gt', User.find({ sg: { $gt: 100 } }).map(function (u) { return u._id; }),
      ['festercluck', 'wanderer']);
check('$gte boundary', User.find({ sg: { $gte: 95 } }).length, 3);
check('$ne', User.find({ 'class': { $ne: 1 } }).length, 2);
check('$in', User.find({ _id: { $in: ['novice', 'wanderer'] } }).length, 2);
check('$elemMatch on subdocument array',
      Page.find({ users: { $elemMatch: { _id: 'festercluck' } } }).length, 1);
check('scalar against array field matches element',
      Page.find({ traps: 1754400000000 }).length, 1);

section('Dates hydrate as Date objects');
var trap = Trap.findOne({ _id: 1754400000000 });
ok('trap.date is a Date', trap.date instanceof Date);
check('trap.date value', trap.date.toISOString(), '2026-08-05T12:00:00.000Z');

section('Writes are isolated to memory');
var novice = User.findOne({ _id: 'novice' });
novice.sg = 999;
novice.save();
check('save persists within the run', User.findOne({ _id: 'novice' }).sg, 999);
mongoose.reset();
check('reset restores fixture value', User.findOne({ _id: 'novice' }).sg, 10);

section('New documents');
var created = new Signpost({
    _id: 1900000000000, user: 'novice', 'class': 1,
    date: new Date('2026-08-06T12:00:00.000Z'), level: 1,
    cmt: 'first post', url: 'http://example.com/new', title: 'New', nsfw: false
});
created.save();
check('created document is findable', Signpost.findOne({ _id: 1900000000000 }).user, 'novice');
check('collection grew', Signpost.find({}).length, 5);
mongoose.reset();
check('reset drops it', Signpost.find({}).length, 4);

section('Update operators');
User.update({ _id: 'festercluck' }, { $inc: { sg: -40 } });
check('$inc', User.findOne({ _id: 'festercluck' }).sg, 200);
User.update({ _id: 'festercluck' }, { $inc: { 'stats.exp.giver': 50 } });
check('$inc on dotted path', User.findOne({ _id: 'festercluck' }).stats.exp.giver, 1500);
Domain.update({ _id: '3d8e577bddb17db339eae0b3d9bcf180' },
              { $addToSet: { users: { _id: 'novice', date: '2026-08-06T12:00:00.000Z' } } });
check('$addToSet', Domain.findOne({ _id: '3d8e577bddb17db339eae0b3d9bcf180' }).users.length, 1);
Domain.update({ _id: '3d8e577bddb17db339eae0b3d9bcf180' },
              { $addToSet: { users: { _id: 'novice', date: '2026-08-06T12:00:00.000Z' } } });
check('$addToSet is idempotent',
      Domain.findOne({ _id: '3d8e577bddb17db339eae0b3d9bcf180' }).users.length, 1);
Domain.update({ _id: '9d5ed678fe57bcca610140957afab571' },
              { $pull: { users: { _id: 'wanderer' } } });
check('$pull', Domain.findOne({ _id: '9d5ed678fe57bcca610140957afab571' }).users.length, 0);
mongoose.reset();

section('findAndModify — the controllers/ inventory pattern');
var modified = User.findAndModify(
    { _id: 'theungodlyone', spiders: { $gt: 0 } }, [],
    { $inc: { spiders: -1 } }, { 'new': true });
check('decrements when inventory suffices', modified.spiders, 4);
var refused = User.findAndModify(
    { _id: 'wanderer', spiders: { $gt: 0 } }, [],
    { $inc: { spiders: -1 } }, { 'new': true });
check('refuses when inventory is empty', refused, null);
check('refused write left state untouched', User.findOne({ _id: 'wanderer' }).spiders, 0);
mongoose.reset();

section('Fixtures agree with config.js game rules');
var cfg = App.tools;
check('giver traps cost 1', cfg.traps.cost[1], 1);
check('guardian shields cost 1', cfg.shields.cost[2], 1);
check('guide doorways cost 1', cfg.doorways.cost[3], 1);
check('guardian shield holds 3 hits', cfg.shields.maxHits[2], 3);
var guardian = User.findOne({ _id: 'theungodlyone' });
check('guardian fixture armor matches maxHits', guardian.armor.hits, cfg.shields.maxHits[2]);
ok('festercluck qualifies for the expert-trap karma bonus',
   User.findOne({ _id: 'festercluck' }).karma <= cfg.traps.expertTraps[0].karma);
ok('theungodlyone does not qualify',
   !(User.findOne({ _id: 'theungodlyone' }).karma <= cfg.traps.expertTraps[0].karma));
var wanderer = User.findOne({ _id: 'wanderer' });
check('guide at level 20 has earned 4 signpost branches',
      cfg.signposts.branches.guide.filter(function (b) {
          return wanderer.stats.lvls.guide >= b.level;
      }).pop().branches, 4);
ok('giver at level 12 meets the anonymous-trap gate of 10',
   User.findOne({ _id: 'festercluck' }).stats.lvls.giver >= cfg.traps.anonymousTrapLV[1]);
ok('novice does not meet it',
   !(User.findOne({ _id: 'novice' }).stats.lvls.giver >= cfg.traps.anonymousTrapLV[1]));

//---------------------------------------------------------------------------
// HTTP routes, against the real app.js
//---------------------------------------------------------------------------

section('HTTP routes served by app.js');

var get = function (p, cb) {
    http.get({ host: '127.0.0.1', port: App.web.port, path: p }, function (res) {
        var body = '';
        res.on('data', function (c) { body += c; });
        res.on('end', function () { cb(null, res.statusCode, body); });
    }).on('error', cb);
};

var server = require(path.join(__dirname, '..', 'app.js'));

setTimeout(function () {
    get('/signposts', function (err, status, body) {
        check('GET /signposts status', status, 200);
        var list = JSON.parse(body);
        check('GET /signposts returns all four', list.length, 4);

        get('/signposts/1753790400000', function (err2, status2, body2) {
            check('GET /signposts/:id status', status2, 200);
            var one = JSON.parse(body2);
            check('GET /signposts/:id returns the right one', one && one.user, 'festercluck');

            get('/users', function (err3, status3, body3) {
                check('GET /users status', status3, 200);
                check('GET /users returns all four', JSON.parse(body3).length, 4);

                get('/auth', function (err4, status4, body4) {
                    check('GET /auth status', status4, 200);
                    ok('GET /auth returns a key', body4.length > 0);
                    report();
                });
            });
        });
    });
}, 400);

var report = function () {
    console.log('\n' + '-'.repeat(60));
    console.log(passed + ' passed, ' + failed + ' failed');
    if (failures.length) {
        console.log('\nFailures:');
        failures.forEach(function (f) { console.log('  - ' + f); });
    }
    process.exit(failed ? 1 : 0);
};
