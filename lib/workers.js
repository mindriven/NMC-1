// @flow
const _logger = require('./logger');
const _config = require('./configs');
const _sendInvoices = require('./jobs/invoicesMailer');

const workers = {};


workers.start = async function () {
    setInterval(async ()=>{
        try{
            await _sendInvoices();
        }
        catch(e)
        {
            _logger.fatal('Unhandled exception during workers run ', e);
        }
    }, _config.workersInterval)
}

module.exports = {start: workers.start};