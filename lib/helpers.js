//@flow
const crypto = require('crypto');
const config = require('./configs');
const helpers = {
    hash: (input: string) => {
        if (typeof input === 'string' && input.length > 0) {
            return crypto.createHmac('sha256', config.hashingSecret).update(input).digest('hex');

        }
        else {
            return false;
        }
    },
    parseJsonToObject: <T>(input: string) : T|{} => {
        try {
            console.log('parsing input', input);
            return JSON.parse(input);
        } catch (e) {
            return {};
    }
}
}

module.exports = helpers;