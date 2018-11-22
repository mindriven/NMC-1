// @flow

const _dal = require('./../DAL');
const _logger = require('./../logger')('oldTokensCleaner');

async function removeExpiredTokens() {
    const now = Date.now();
    const expiredTokens = (await _dal.getAllTokens()).filter(t=>t.expires < now);
    _logger.info('found '+expiredTokens.length+' tokens to clean');
    return Promise.all(expiredTokens.map(async token=>_dal.removeToken(token.token)));
    
};

module.exports = removeExpiredTokens;