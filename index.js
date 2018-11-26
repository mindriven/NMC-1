// @flow
const server = require('./lib/server/server');
const workers = require('./lib/workers');
const cli = require('./lib/cli');
server.start();
workers.start();

setTimeout(function(){
    cli.init();
  },50);