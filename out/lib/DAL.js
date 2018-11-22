//      
const _data = require('./data');
const _helpers = require('./helpers');
const _logger = require('./logger.js')('dal');

                                                                  

const USERS_DIR = 'users';
const ORDERS_DIR = 'orders';
const TOKENS_DIR = 'tokens';
const CARTS_DIR = 'carts';
const LOGS_DIR = '.logs';
// initialize directories
_data.makeSureDirectoriesExist(USERS_DIR, ORDERS_DIR, TOKENS_DIR, CARTS_DIR, LOGS_DIR);

const dal = {};
dal.findUserById = (id        )                 => parseNoException(_data.read(USERS_DIR, id));
dal.findOrderById = (id        )                  => parseNoException(_data.read(ORDERS_DIR, id));
dal.findTokenById = (id        )                  => parseNoException(_data.read(TOKENS_DIR, id));
dal.findCartByUserId = (id        )                 => parseNoException(_data.read(CARTS_DIR, id));

dal.saveUser = (user      )                => _data.createOrUpdate(USERS_DIR, user.id, user);
dal.saveOrder = (order       )                => _data.createOrUpdate(ORDERS_DIR, order.id, order);
dal.saveCart = (cart      , userId        )                => _data.createOrUpdate(CARTS_DIR, userId, cart);
dal.saveToken = (token       )                => _data.createOrUpdate(TOKENS_DIR, token.token, token);

dal.removeUser = (userId        )                => noException(_data.delete(USERS_DIR, userId));
dal.removeCart = (userId        )                => noException(_data.delete(CARTS_DIR, userId));
dal.removeToken = (token        )                => noException(_data.delete(TOKENS_DIR, token));

dal.removeLog = (fileName        )                => noException(_data.delete(LOGS_DIR, fileName));
dal.readLogContent = (fileName        )                   => noException(_data.read(LOGS_DIR, fileName));
dal.saveInLogsDir = (content        , fileName        )                => _data.createOrUpdate(LOGS_DIR, fileName, content);

dal.readMenu = async () => _helpers.parseJsonToObject(await _data.read('', 'menu'))

dal.getAllOrders = async () => (await Promise.all((await _data.listFiles(ORDERS_DIR))
                                    .map(name => name.replace('.json', ''))
                                    .map(async id => await dal.findOrderById(id))))
                                    .filter(o=>o);

dal.getAllTokens = async () => (await Promise.all((await _data.listFiles(TOKENS_DIR))
                                    .map(name => name.replace('.json', ''))
                                    .map(async id => await dal.findTokenById(id))))
                                    .filter(o=>o);

dal.listAllLogsFiles = async () => (await _data.listFiles('.logs')).filter(f=>f.endsWith('.log'));

async function parseNoException   (promise                       )             {
    const result  = await noException(promise);
    return result? _helpers.parseJsonToObject(result) : undefined;
}

async function noException   (promise                 )                   {
        return promise.catch(e=>{
            _logger.error('exception was thrown, but will be muted by design', e);
        });
} 

module.exports = dal;