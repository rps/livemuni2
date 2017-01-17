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

    var inboundOutboundJSON = {
      inbound: {}, 
      outbound: {}
    };
    var direction = '';
    var isOutbound = false;
    var directionObj = {};
    var newVehicle = {};
    var formattedJSON = Object.keys(vehicleObj).reduce(function(acc, key) {
      currentVehicle = vehicleObj[key];
      // Drop & log vehicles without direction tags
      if (!currentVehicle.dirTag) {
        // console.log('no dirTag on id:', currentVehicle.id);
        return acc;
      }

      // Determine inbound / outbound
      isOutbound = currentVehicle.dirTag.indexOf('_O_') > 0;
      direction = isOutbound ? 'outbound' : 'inbound';

      // Capture the object to be modified
      directionObj = acc[direction];

      // Add LINE as a Key
      directionObj[currentVehicle.routeTag] = directionObj[currentVehicle.routeTag] || {};

      // Add BUS to LINE
      newVehicle = directionObj[currentVehicle.routeTag];
      newVehicle[currentVehicle.id] = currentVehicle; // removes duplicate IDs, if there are any
      
      return Object.assign(acc, isOutbound ? {outbound: directionObj} : {inbound: directionObj});
    }, inboundOutboundJSON);
    return formattedJSON;
  },
  getAndWriteData: function() {
    var currentTime = new Date(Date.now())
    console.log('querying at: ', currentTime)
    var agency = 'sf-muni'; // many options: http://webservices.nextbus.com/service/publicXMLFeed?command=agencyList
    var time = '0';         // after epoch time; 0 is last 15 minutes
    var url = 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a='+agency+'&t='+time;
    var cb = function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var result = lm.formatJSON(body);
        lm.saveToFirebase(result);
      }
    }

    request(url, cb);
  },
  saveToFirebase: function(result) {
    console.log('saving to firebase');

    admin.database().ref('/').set(result).then(function() {
      console.log('saved!');
    });
  },
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

  setInterval(lm.getAndWriteData, 10000);

  if (req.method === 'GET') {
    if(req.url === '/') {
      res.statusCode = 200;
      res.end('Online');
    } else if(req.url === '/all') {
      res.statusCode = 200;
      res.end(lm.fetch());
    }
  } else {
    res.statusCode = 404;
    res.end();
  }
}).on('listening', function (){
  setInterval(lm.getAndWriteData, 10000);
}).listen(process.env.PORT || 8080);
