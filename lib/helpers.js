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
    parseJsonToObject: <T>(input: string) : ?T => {
        console.log('trying to parse', input);
        try {return JSON.parse(input);}
        catch (e) { return undefined;}
    },
    createRandomString: (len: number = 20): ?string => {
        const validLength = typeof(len) === 'number' ? len || false : false;
        return validLength
            ? crypto.randomBytes(Math.ceil(validLength/2)).toString('hex').slice(0,validLength)
            : undefined;
    }
}

module.exports = helpers;