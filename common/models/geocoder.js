'use strict';

var geocoderProvider = 'openstreetmap',
  app = require('../../server/server'),
  protocol = 'https';

// optional
var extra = {
  apiKey: 'YOUR_API_KEY', // for Mapquest, OpenCage, Google Premier
  formatter: null     // 'gpx', 'string', ...
};

var geocoder = require('node-geocoder')(geocoderProvider, protocol, extra);

module.exports = function(Geocoder) {

  Geocoder.remoteMethod(
    'forwardGeo',
    {
      description: 'Geocode a partial address',
      accepts: {
        arg: 'args',
        type: 'object',
        description: 'object with "address" property',
        required: true,
        http: { source: 'body' }
      },
      returns: {type: 'array', root: true},
      http: {path: '/forward-geo', verb: 'post'}
    }
  );

  Geocoder.forwardGeo = function(args, cb) {
    geocoder.geocode(args.address)
    .then(data => cb(null, data))
    .catch(cb);
  };

  Geocoder.geocodeEvent = function(parsedEventId) {

    var ParsedEvent = Geocoder.app.models.ParsedEvent;

    var filter = {
      where: {
        id: parsedEventId
      }
    };

    return ParsedEvent.findOne(filter)
    .then(function(item){
      if (!item){
        console.log("no item found to geocode.");
        return;
      }

      if (!item.locations || !item.locations.length){
        console.log("no locations to geocode.");
        return;
      }

      return geocoder.geocode(item.locations[0])
      .then(function(res) {
        if (!res.length){
          return;
        }

        item.lat = res[0].latitude;
        item.lng = res[0].longitude;
        item.geocoded = true;

        return item.save();
      });

    })
    .catch(console.error);
  };

};
