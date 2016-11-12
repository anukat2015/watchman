'use strict';

// def: Parse a social media page's content to find the user-submitted image
// and download it for processing. Assumes image is jpeg format.
// returns custom exceptions so caller can distinguish between expected
  // problems like timeouts, unspecified domains, and unexpected errors.

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
    maxRedirects: 2
  };

// require('request').debug = true

module.exports = { fetchImage };

// callback: function(err, data)
function fetchImage(url, downloadPath, callback) {
  const tr = trumpet();
  let match = false;

  downloadPath = downloadPath || '.'; // default to cwd
  mkdirp(downloadPath);

  // 1) Set up html parser + attach pipes:
  // outer: for a non-enclosing tag like meta.
  // twitter & instagram use FB open graph tags.
  tr.createReadStream('meta[property="og:image"]', {outer: true})
  .on('end', () => {
    // trumpet stops piping when no matches. ugh.
    // HACK: 'data' handler checks for selector success.
    // TODO: better way to return 'no matches'?
    if (!match)
      callback(new FetchException('could not find image info'));
  })
  .on('data', data => {
    let line = data.toString();
    match = /og:image/i.test(line);
  })
  .pipe(findImageUrl()).on('error', callback)
  .pipe(downloadImage(downloadPath)).on('error', callback)
  .pipe(consume(callback))
  // continue processing if you like...
  // .pipe(process.stdout);

  // 2) Start the pipeline
  require('request').get(url, requestOptions)
  .on('response', function(res) {
    if (res.statusCode > 399)
      callback(new FetchException(`statuscode ${res.statusCode} for ${url}`));
  })
  .on('error', err => {
    console.error('get url err:', err);
    callback(new FetchException(`failed to get ${url}`));
  })
  .pipe(tr);
}

function findImageUrl() {
  return through2((chunk, enc, cb) => {
    let data = chunk.toString(); // from buffer
    if (!/instagram\.com/i.test(data) && !/twitter\.com/i.test(data)) {
      cb(new FetchException(`skipping ${data}`));
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
  let imagePath = path.join(downloadPath, uuid.v4() + '.jpg');

  return through2((chunk, enc, cb) => {
    let imageUrl = chunk.toString(),
      ws = fs.createWriteStream(imagePath);
    require('request').get(imageUrl, requestOptions)
    .on('response', function(res) {
      if (res.statusCode > 399)
        cb(new FetchException(`statuscode ${res.statusCode} for ${imageUrl}`));
    })
    .on('error', err => {
      console.error('download err:', err);
      // del empty files
      // fs.unlinkSync(imagePath);
      cb(new FetchException(`failed to download ${imageUrl}`));
    })
    .on('end', () => {
      // del empty files
      let stats = fs.statSync(imagePath);
      if (!stats.size)
        fs.unlinkSync(imagePath);
      let output = {
        path: imagePath,
        url: imageUrl
      };
      cb(null, JSON.stringify(output));
    })
    .pipe(ws);
  });
}

// invoke consumer's callback. also continue piping...
function consume(callback) {
  return through2((chunk, enc, next) => {
    callback(null, chunk.toString());
    next(null, chunk.toString()); // if we add another step later
  });
}

if (require.main === module) {
  fetchImage('https://www.instagram.com/p/BJsmWmLDiD3/', './tmp', console.log)
  // fetchImage('https://www.facebook.com/photo.php?fbid=10157557232495468', './tmp', console.log)
  // fetchImage('https://twitter.com/Abizy_m/status/775762443817607170')
  // fetchImage('https://www.swarmapp.com/c/8Ez3xo3RtcP')
}
