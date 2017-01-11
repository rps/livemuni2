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

lm.FormatJSON = function(responseJSON) { // key is line name
  var inboundOutboundJSON = {
    inbound: {}, 
    outbound: {}
  };
  var direction = '';
  var current = {};
  var val = {};
  var formattedJSON = Object.keys(responseJSON).reduce(function(acc, key) {
    val = responseJSON[key];
    direction = val.dirTag.indexOf('_O_') > 0 ? 'outbound' : 'inbound';
    current = acc[direction][val.routeTag] || {};
    // debugger;
    current[val.id] = val;
    return Object.assign()
  }, inboundOutboundJSON);
  debugger;
};