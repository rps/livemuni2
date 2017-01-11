var lm = {};
var agency = 'sf-muni';

firebase.initializeApp(config); // initialize firebase

lm.Update = function() {
  console.log('test');
  var request = new XMLHttpRequest();
  var url = 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=' + agency + '&t=0';

  request.open('GET', url, true);
  request.send(null);

  // state changes
  request.onreadystatechange = function() {
    if(request.readyState === 4) { // done
      if(request.status === 200) { // complete 
        var x2js = new X2JS();
        var jsonObj = x2js.xml2json(request.responseXML);
        lm.FormatJSON(jsonObj.body.vehicle); // array of vehicles
      }
    }
  };
};

lm.FormatJSON = function(vehicleObj) { // array-like object with index keys
  var inboundOutboundJSON = {
    inbound: {}, 
    outbound: {}
  };
  var direction = '';
  var isOutbound = false;
  var directionObj = {};
  var newVehicle = {};
  var val = {};
  var formattedJSON = Object.keys(vehicleObj).reduce(function(acc, key) {
    currentVehicle = vehicleObj[key];
    // Drop vehicles without direction
    if (!currentVehicle._dirTag) {
      return acc;
    }
    // Determine inbound / outbound
    isOutbound = currentVehicle._dirTag.indexOf('_O_') > 0;
    direction = isOutbound ? 'outbound' : 'inbound';

    // Capture the object to be modified
    directionObj = acc[direction];

    // Add LINE as a Key
    directionObj[currentVehicle._routeTag] = directionObj[currentVehicle._routeTag] || {};

    // Add BUS to LINE
    newVehicle = directionObj[currentVehicle._routeTag];
    newVehicle[currentVehicle._id] = currentVehicle; // removes duplicate IDs, if there are any
    
    return Object.assign(acc, isOutbound ? {outbound: directionObj} : {inbound: directionObj});
  }, inboundOutboundJSON);
};
