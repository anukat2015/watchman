'use strict';

// def: Parse a social media page's content to find the user-submitted image
// and download it for processing. Assumes image is jpeg format.

const trumpet = require('trumpet'),
  request = require('request'),
  fs = require('fs'),
  mkdirp = require('mkdirp'),
  path = require('path'),
  uuid = require('uuid'),
  through2 = require('through2'),
  FetchException = require('./fetch-exception'),
  requestOptions = {
    timeout: 5000, //ms
    followRedirect: true,
    forever: true,
    // headers: {
    // 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11'
    // }
  };

// require('request').debug = true

module.exports = { fetchImage };

// callback: function(err, data)
function fetchImage(url, downloadPath, callback) {
  const tr = trumpet();

  downloadPath = downloadPath || '.'; // default to cwd
  mkdirp(downloadPath);

  // outer: for a non-enclosing tag like meta.
  // twitter & instagram use FB open graph tags.
  tr.createReadStream('meta[property="og:image"]', {outer: true})
  // .on('data', (a,b,c) => {
  //   debugger
  // })
  .on('error', (e,i) => {
    debugger
  })
  .pipe(findImageUrl()).on('error', callback)
  .pipe(downloadImage(downloadPath)).on('error', callback)
  .pipe(consume(callback))
  // continue processing if you like...
  // .pipe(process.stdout);

  require('request').get(url, requestOptions)
  // .on('data', (a,b,c) => {
  //   debugger
  // })
  // .on('response', function(res) {
  //   debugger
  //   if (res.statusCode > 399)
  //     callback(new FetchException(`failure response ${res.statusCode}`));
  // })
  .on('error', callback)
  // .on('end', console.log)
  .pipe(tr);
}

// invoke consumer's callback. also continue pipelining...
function consume(callback) {
  return through2((chunk, enc, next) => {
    callback(null, chunk.toString());
    // next(null, chunk.toString()); // if we add another step later
  });
}

function findImageUrl() {
  return through2((chunk, enc, cb) => {
    debugger
    let data = chunk.toString(); // from buffer
    if (!/instagram\.com/i.test(data) && !/twitter\.com/i.test(data)) {
      cb(new FetchException('invalid image source'));
      return;
    }

    let matches = data.match(/(http.*)"/i);

    if (matches) {
      let url = matches[1];
      /\/profile/i.test(url) ?
        cb(new FetchException('image url found but was profile pic')) :
        cb(null, url);
    } else {
      cb(new FetchException('image url not found'));
    }
  });
}

function downloadImage(downloadPath) {
  // all downloads expected to be jpeg format
  let imagePath = path.join(downloadPath, uuid.v4() + '.jpg'),
    ws = fs.createWriteStream(imagePath);

  return through2((chunk, enc, cb) => {
    let imageUrl = chunk.toString();
    // TODO: what happens when request fails?
    console.log(imageUrl);
    require('request').get(imageUrl, requestOptions)
    .on('response', function(res) {
      if (res.statusCode > 399)
        cb(new FetchException(`failure response ${res.statusCode}`));
    })
    .on('error', cb)
    .pipe(ws);
    let output = {
      path: imagePath,
      url: imageUrl
    };
    cb(null, JSON.stringify(output));
  });
}

if (require.main === module) {
  // fetchImage('https://www.instagram.com/p/BJsmWmLDiD3/', './tmp', console.log)
  fetchImage('https://www.facebook.com/photo.php?fbid=10157557232495468', './tmp', console.log)
  // fetchImage('https://twitter.com/Abizy_m/status/775762443817607170')
  // fetchImage('https://www.swarmapp.com/c/8Ez3xo3RtcP')
}
