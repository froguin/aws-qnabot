<template lang='pug'>
v-container#page-import(column, grid-list-md)
  v-layout(column)
    v-flex
      v-card
        v-card-title.display-1.pa-2 Kendra Web Crawling
        v-card-text
          h3 For more information about Kendra Web Crawling, see <a href="https://github.com/aws-samples/aws-ai-qna-bot/blob/master/docs/kendra_crawler_guide/README.md" target="_blank">here</a>
        v-card-text(v-if="kendraIndexerEnabled == true")
          p Current Status {{ status }}
        v-card-text(v-if="!kendraIndexerEnabled")
          p The following settings should be configured.
          p  
          p ENABLE_KENDRA_WEB_INDEXER - should be set to true
          p KENDRA_WEB_PAGE_INDEX - the ID of the Kendra Index used to store the content of the web pages
          p KENDRA_INDEXER_URLS - a comma separated list of web pages to index
        v-card-actions
          v-btn#btnKendraStartIndex(
            :disabled="status == 'PENDING' || status == 'STARTING' || !kendraIndexerEnabled",
            @click="start"
          ) Start Crawling
        v-flex(v-if="history && history.length > 0")
          v-card-title.headline Kendra Crawling History
          v-card-text
            h3 <a :href="dashboard_url" target="_blank">View Web Crawling Errors in CloudWatch </a>

          v-card-text
            table.table
              tr
                th(style="text-align: left") Start Time
                th(style="text-align: left") End Time
                th(style="text-align: left") Status
                th(style="text-align: left") Error Message
                th(style="text-align: left") Documents Scanned
                th(style="text-align: left") Documents Added
                th(style="text-align: left") Documents Modified
                th(style="text-align: left") Documents Deleted
                th(style="text-align: left") Documents Failed

              template(v-for="(job, index) in history")
                tr
                  td {{ convertToLocalTime(job.StartTime) }}
                  td {{ convertToLocalTime(job.EndTime) }}
                  td {{ job.Status }}
                  td {{ job.ErrorMessage }}
                  td {{ job.Metrics.DocumentsScanned }}
                  td {{ job.Metrics.DocumentsAdded }}
                  td {{ job.Metrics.DocumentsModified }}
                  td {{ job.Metrics.DocumentsDeleted }}
                  td {{ job.Metrics.DocumentsFailed }}
</template>

<script>
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

var Vuex = require("vuex");
var Promise = require("bluebird");
var _ = require("lodash");
var Promise = require("bluebird");

module.exports = {
  data: function () {
    var self = this;
    return {
      status: "",
      dashboard_url:"",
      history: {},
      dialog: false,
      text: false,
      ready: false,
      kendraIndexerEnabled: false,
      lastStatusCheck: Date.now(),
      intervalBetweenPoll: 10000,
      isPolling: 0
    };
  },
  components: {},
  computed: {},
  updated: function () {
    console.log("updated");
    var self = this;
    if(!self.kendraIndexerEnabled){
      self.IsKendraEnabled().then((data) => {
        self.kendraIndexerEnabled = data;
      })
    }
    this.poll(
      () => {


        console.log("last status check " + self.lastStatusCheck);
        if (!self.lastStatusCheck || (Date.now() - self.lastStatusCheck > self.intervalBetweenPoll)) {
              self.lastStatusCheck = Date.now();
          console.log("getting status");
          self.getKendraIndexingStatus().then((data) => {
            if(self.status == "SUCCEEDED" && data.Error && data.Error.toLowerCase().includes("not found")){
              // Most likely caused by Kendra Throttling error, don't change the current status
              self.intervalBetweenPoll = 20000
              return
            }
            self.dashboard_url = data.DashboardUrl;
            self.status = data.Status;
            self.history = data.History;
            self.intervalBetweenPoll = 10000
          });
        }
        //if the Kendra Start Index isn't displayed -- stop syncing
        var shouldPoll = (
          document.getElementById("btnKendraStartIndex") &&
          document.getElementById("btnKendraStartIndex").offsetWidth == 0
        ) == null;
        console.log("Should Poll " + shouldPoll);
        return shouldPoll;
      },
      600000,
      10000
    ).catch((error) => console.log("Error trying to retrieve status " + error));
  },
  mounted: function () {
    var self = this;


    console.log("updated");
    var self = this;
    self.getKendraIndexingStatus().then((data) => {
      self.status = data.Status;
      (self.history = data.History),
        console.log("History " + JSON.stringify(self.history));
      self.lastStatusCheck = Date.now();
    });
    self.$forceUpdate();
  },
  methods: {
    start: async function () {
      this.$store
        .dispatch("api/startKendraV2Indexing")
        .catch((err) =>
          console.log(`error while trying to start indexing ` + err)
        );
      this.status = "STARTING";
      await new Promise((r) => setTimeout(r, 3000));
      this.getKendraIndexingStatus().then((data) => {
        this.status = data.Status;
      });
      this.$forceUpdate();
    },

    getKendraIndexingStatus: async function () {
      var result = await this.$store.dispatch("api/getKendraIndexingStatus");
      return result;
    },
    convertToLocalTime: function (isoDateTime) {
      if(isoDateTime == ""){
        return ""
      }
      var isoDateTime = new Date(isoDateTime);
      return (
        isoDateTime.toLocaleDateString() +
        " " +
        isoDateTime.toLocaleTimeString()
      );
    },

    IsKendraEnabled: async function(){
        
        const settings=await this.$store.dispatch('api/listSettings');
        console.log(JSON.stringify(settings));
        return _.get(settings[2],"ENABLE_KENDRA_WEB_INDEXER")=="true" && _.get(settings[2],"KENDRA_INDEXER_URLS") !== "" 
        && _.get(settings[2],"KENDRA_WEB_PAGE_INDEX") !== "";
      },
    

    poll: function (fn, timeout, interval) {
      var endTime = Number(new Date()) + (timeout || 2000);
      interval = interval || 100;

      var checkCondition = function (resolve, reject) {
        // If the condition is met, we're done!
        var result = fn();
        if (result) {
          resolve(result);
        }
        //If the condition isn't met but the timeout hasn't elapsed, go again
        else if (true) {
          /*Number(new Date()) < endTime) */ setTimeout(
            checkCondition,
            interval,
            resolve,
            reject
          );
        }
        // Didn't match and too much time, reject!
        else {
          reject(new Error("timed out for " + fn + ": " + arguments));
        }
      };

      return new Promise(checkCondition);
    },
  },
};
</script>

<style lang='scss' scoped>
</style>

