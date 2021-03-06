//     
const crypto = require('crypto');
const config = require('./configs');
const https = require('https');
const _logger = require('./logger')('helpers');
const util = require('util');
const querystring = require('querystring');

const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function reviver(key, value) {
  if (typeof value === "string" && dateFormat.test(value)) {
    return new Date(value);
  }

  return value;
}

const helpers = {
    hash: (input        ) => {
        if (typeof input === 'string' && input.length > 0) {
            return crypto.createHmac('sha256', config.hashingSecret).update(input).digest('hex');

        }
        else {
            return false;
        }
    },
    parseJsonToObject:    (input        )      => {
        try {return JSON.parse(input, reviver);}
        catch (e) { return undefined;}
    },
    createRandomString: (len         = 20)          => {
        const validLength = typeof(len) === 'number' ? len || false : false;
        return validLength
            ? crypto.randomBytes(Math.ceil(validLength/2)).toString('hex').slice(0,validLength)
            : undefined;
    },
    encodePostData: (data       ) =>querystring.stringify(data),
    getResponseBodyAsString: async (options        , requestData        )                        => {
        return new Promise((res, rej)=>{
            const req = https.request(options, resp => {
                let data = '';
                resp.on('data', chunk => {data += chunk;});
                resp.on('end', () => {
                    if(resp.statusCode!==200)
                    {
                        _logger.error(`request to ${options.host}${options.path} returned with code ${resp.statusCode}`);
                        res(false);
                    }
                    _logger.debug(`got all the response from ${options.host} ${options.path}`);
                    _logger.trace(`response code is ${resp.statusCode}, body is ${data}`);
                    res(data);
                });
            });
        
            req.on('error', (e) => {
                _logger.error("Error during calling request with options", options, e);
                res(false);
            });
            _logger.debug(`going to do web request to ${options.host} ${options.path}`);
            _logger.trace('request payload:', requestData);
            req.write(requestData);
            req.end();
        });
    }
}

module.exports = helpers;