'use strict';

// TODO: move redis bits to own module

const redis = require('redis'),
  sub = redis.createClient({ host: 'redis' }), pub = redis.createClient({ host: 'redis' }),
  bluebird = require('bluebird'),
  fetchImage = require('./image-fetcher').fetchImage,
  _ = require('lodash'),
  FetchException = require('./fetch-exception'),
  channelName = 'genie:fetch_image'
;

bluebird.promisifyAll(redis.RedisClient.prototype);

const errRedis = err => console.error('Redis Error:', err);

pub.on('error', errRedis);
sub
  .on('error', errRedis)
  .on('subscribe', (channel, count) => {
    console.info(`subscribed to channel ${channel}`);
  })
  .on('message', (channel, msg) => {
    // console.log(msg)
    let key = msg;
    pub.hgetallAsync(key)
      .then(processJob(key));
  });

sub.subscribe(channelName);

function processJob(key) {
  return job => {
    if (_.isEmpty(job.urls)) {
      job.state = 'error';
      job.error = 'Missing "urls" required field';
      // job.data = [];
      updateJob(key, job);
      return;
    }
    fetchImage(job.urls, './tmp', afterFetch(key, job));
  }
}

function afterFetch(key, job) {
  return (err, imageInfo) => {
    if (err) {
      if (err instanceof FetchException) {
        // ignore warnings
        console.info('info:', err.message);
        job.state = 'processed';
        job.data = JSON.stringify([]);
      } else {
        job.state = 'error';
        job.error = err.toString();
        // job.data = [];
      }
    } else {
      job.state = 'processed';
      job.data = imageInfo;
    }

    updateJob(key, job);
  };
}

function updateJob(key, job) {
  pub.hmsetAsync(key, job)
    .then(() => console.info(`job ${key} updated`));
}

if (require.main === module) {
  // let testKey = 'genie:1'
  // pub.hmsetAsync(testKey, { urls: 'https://www.swarmapp.com/c/8Ez3xo3RtcP' })
  //   .then(() => {
  //     pub.publishAsync('genie:fetch_image', testKey)
  //   })
}
