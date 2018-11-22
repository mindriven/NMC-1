//      
const _config = require('./configs');
const _data = require('./data');

const levels = {
    off: 0,
    fatal: 6,
    error: 5,
    warn: 4,
    info: 3,
    debug: 2,
    trace: 1
};

const logTarget = _config.logTarget || 'both';
const logLevel         = Number.isInteger(_config.logLevel) ? _config.logLevel : 6;

function createLogger(componentName        ) {

    const logger = {
        fatal: (...args       ) => {logLevel >= levels.fatal ? logger.log(args, 'fatal') : {};},
        error: (...args       ) => {logLevel >= levels.error ? logger.log(args, 'error') : {};},
        warn: (...args       ) => {logLevel >= levels.warn ? logger.log(args, 'warn') : {};},
        info: (...args       ) => {logLevel >= levels.info ? logger.log(args, 'info') : {};},
        debug: (...args       ) => {logLevel >= levels.debug ? logger.log(args, 'debug') : {};},
        trace: (...args       ) => {logLevel >= levels.trace ? logger.log(args, 'trace') : {};},
        log: (args     , logLevel         = '') => {
            const argsToLog = ['[' + (new Date).toISOString() + (logLevel?(' '+logLevel):'')+`, ${componentName}]`, [...args.map(i=>'    '+i)].join('\r\n'), '\r\n'];
            if (logTarget === 'console' || logTarget === 'both') {console.log(argsToLog);} //TODO add color
            if (logTarget === 'file' || logTarget === 'both') {
                _data.createOrAppend('.logs', (new Date).toISOString().split('T')[0], argsToLog);
            }
        }
    };
    return logger;
};

module.exports = createLogger;