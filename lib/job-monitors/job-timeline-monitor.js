'use strict';
var request = require("request");
const API_ROOT = process.env.API_ROOT;
require('dotenv').config({silent: true});
// def: check all JobMonitor changes and try to start a LinkerMonitor when:
  // 1. a monitor is updated to 'done'
  // 2. all its related monitors (non-linker, same timeframe) are also done
module.exports = {
  start(app) {
    const JobMonitor = app.models.JobMonitor;
    const SocialMediaPost = app.models.SocialMediaPost;
    let currentJobSet = [];
    let currentRunAttemptCount = 0;
    let socialMediaPostThreshold = 1000;
    //Gets set automatically based on time window and interval and multiplier
    let runAttemptThreshold = 10;
    let runAttemptThresholdMultiplier = 3;
    let JobCheckInterval = 5000;

    let interval = setInterval(function(){
      checkJobsStatus();
    },JobCheckInterval);


    function checkJobsStatus() {
      currentJobSet = [];
      JobMonitor.findOne({where:{
        and:[
          {state:{neq:"done"}},
          {state:{neq:"new"}}
        ]
      }},maybeWaitForJobToComplete);

    }

    function maybeWaitForJobToComplete(err,data){
      if(data || err) return;
      JobMonitor.findOne({"where":{"state":"new"}},getRunSetId)
    }

    function getRunSetId(err, data){
      if(!data || err || data.end_time > Date.now()){
        if(data && data.end_time > Date.now()){
          console.log("Next job set end_time > now, waiting for time to catch up.")
        }
        return;
      }
      
      runAttemptThreshold = ((data.end_time - data.start_time) * runAttemptThresholdMultiplier)/JobCheckInterval;

      JobMonitor.find({"where":{"run_set_id":data.run_set_id}},checkForPostCount);
    }

    function checkForPostCount(err, data){
      if(!data || err) return;
      currentJobSet = data;
      currentRunAttemptCount = currentJobSet[0].run_attempt_count + 1;
      currentJobSet.forEach(function(element){
        element.updateAttributes({"run_attempt_count":currentRunAttemptCount},function(err, data){});
      });

      SocialMediaPost.count({"timestamp_ms":{"between":[currentJobSet[0].start_time,currentJobSet[0].end_time]}}, maybeRunTheJob)
    }

    function maybeRunTheJob(err, count){
      if(count===null || count===undefined || err) return;

      if(count < socialMediaPostThreshold){
        if(currentRunAttemptCount > runAttemptThreshold){
          currentJobSet.forEach(function(element,index) {
            element.updateAttributes(
              {
                state: "done",
                error_msg: "Job timed out, not enough data to process."
              }, function (err, data) {
                console.log("Job timed out, not enough data to process: " + element.id);
              });
          })
        }
        return;
      }


      currentJobSet.forEach(function(element) {
        let url = API_ROOT+"/jobMonitors/" + element.id.toString();
        let data = {
          "start": true
          };

        request({
            url: url,
            method: "PUT",
            json: data
          }, function (error, resp, body) {

        });
      });

    }
  }
};
