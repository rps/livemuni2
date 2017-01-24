var request = require('request');
var http = require('http');
var parser = require('xml2json');
var admin = require('firebase-admin');
var serviceAccount = require('../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL
});

var lm = {
  fetch: function() {
    return admin.database().ref().once('value').then(function(snapshot) {
      return snapshot.val();
    });
  },
  formatJSON: function(body) { 
    var responseJSON = parser.toJson(body, {object: true});
    var vehicleObj = responseJSON.body.vehicle; // array-like object with index keys

    /* This value can be used as the “t” parameter for the next call to the vehicleLocations
    command so that only GPS reports since the last time the command was called will be returned.
    This is useful for preventing reading in vehicle locations that have not changed */
    var lastTime = responseJSON.body.lastTime.time;

    var formattedJSON = Object.keys(vehicleObj).reduce(function(acc, key) {
      currentVehicle = vehicleObj[key];

      if (currentVehicle.dirTag) {
        acc[currentVehicle.dirTag] = acc[currentVehicle.dirTag] || {};
        acc[currentVehicle.dirTag][currentVehicle.id] = {
          id: currentVehicle.id,
          dirTag: currentVehicle.dirTag,
          routeTag: currentVehicle.routeTag,
          lat: currentVehicle.lat,
          lon: currentVehicle.lon
        };
      }

      return acc;
    }, {});
    return {directions: formattedJSON, time: lastTime};
  },
  getAndWriteData: function() {
    var currentTime = new Date(Date.now())
    console.log('querying at: ', currentTime)
    var agency = 'sf-muni'; // many options: http://webservices.nextbus.com/service/publicXMLFeed?command=agencyList
    var time = lm.time;     // after epoch time; 0 is last 15 minutes
    var url = 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a='+agency+'&t='+time;
    var cb = function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var result = lm.formatJSON(body);
        var directions = result.directions;
        lm.time === '0' ? lm.setToFirebase(directions) : lm.saveToFirebase(directions);
        lm.time = result.time;
      }
    }

    request(url, cb);
  },
  saveToFirebase: function(result) {
    console.log('UPDATING firebase');
    var updates = {};
    Object.keys(result).forEach(function(dirTag, i) {
      Object.keys(result[dirTag]).forEach(function(id, i) {
        updates['/buses-by-dirtag/' + dirTag + '/' + id] = result[dirTag][id];
      });
    });
    admin.database().ref().update(updates).then(function() {
      console.log('saved!');
    });
  },
  setToFirebase: function(result) {
    console.log('SETTING firebase');
    admin.database().ref('/buses-by-dirtag/').set(result).then(function() {
      console.log('saved!');
    });
  },
  time: '0'
};

http.createServer(function(req, res) {
  req.on('error', function(err) {
    console.error(err);
    res.statusCode = 400;
    res.end();
  });
  res.on('error', function(err) {
    console.error(err);
  });

  if (req.method === 'GET') {
    if(req.url === '/') {
      res.statusCode = 200;
      res.end('Online');
    } else if(req.url === '/all') {
      res.statusCode = 200;
      var allBuses = lm.fetch();
      allBuses.then(
        function(buses) {
          res.end(JSON.stringify(buses));
        }, function() {
          res.end('No Data');
        }
      );
    }
  } else {
    res.statusCode = 404;
    res.end();
  }
}).on('listening', function (){
  console.log('Listening on: ', process.env.PORT || 8080);
  setInterval(lm.getAndWriteData, 10000);
}).listen(process.env.PORT || 8080);
