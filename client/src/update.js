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
        // var responseJSON = xmlToJSON.parseString(request.responseText);
        lm.FormatJSON(responseJSON.body[0].vehicle); // array of vehicles and _attr
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
    direction = val._attr.dirTag.indexOf('_O_') > 0 ? 'outbound' : 'inbound';
    current = acc[direction][val._attr.routeTag] || {};
    // debugger;
    current[val._attr.id] = val._attr;
    return Object.assign()
  }, inboundOutboundJSON);
  debugger;
};