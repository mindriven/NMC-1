// @flow

const _dal = require('./../DAL');
const zlib = require('zlib');
const util = require('util');
const _logger = require('./../logger')('logsArchiver');

const gzip = util.promisify(zlib.gzip);

async function archiveLogs(nameModifier: string) {

    const logFiles = await _dal.listAllLogsFiles();
    _logger.info('found '+logFiles.length+' log files to archive');
    return Promise.all(logFiles.map(async logFile => {
        const logContent = await _dal.readLogContent(logFile);
        const gzippedContentBuffer = await gzip(logContent);
        const targetName = logFile +nameModifier+ 'gz.b64';
        await _dal.saveInLogsDir(gzippedContentBuffer.toString('base64'), targetName);
        await _dal.removeLog(logFile);
        _logger.debug(`archived log ${logFile} -> ${targetName}`);
    }));
};

module.exports = archiveLogs;