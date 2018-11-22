//      
const _logger = require('./logger')('workers');
const _config = require('./configs');
const _sendInvoices = require('./jobs/invoicesMailer');
const _archiveLogs = require('./jobs/logsArchiver');
const _cleanOldTokens = require('./jobs/oldTokensCleaner');

const workers = {};


workers.start = async function () {
    setInterval(async ()=>{
        try{
            await _sendInvoices();
        }
        catch(e)
        {
            _logger.fatal('Unhandled exception during invoice sender workers run ', e);
        }
    }, _config.invoiceSenderInterval);

    setInterval(async ()=>{
        try{
            await _archiveLogs(Date.now().toString());
        }
        catch(e)
        {
            _logger.fatal('Unhandled exception during logs archiver run ', e);
        }
    }, _config.logsArchiverInterval);

    setInterval(async ()=>{
        try{
            await _cleanOldTokens();
        }
        catch(e)
        {
            _logger.fatal('Unhandled exception during tokens cleanup', e);
        }
    }, _config.tokensCleanupInterval);
}

module.exports = {start: workers.start};