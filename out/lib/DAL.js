//      
const _data = require('./data');
const _helpers = require('./helpers');
const _logger = require('./logger.js');

                                                                  

// initialize directories
_data.makeSureDirectoriesExist('users', 'orders', 'carts', 'tokens', '.logs');

const dal = {};
dal.findUserById = (id        )                 => parseNoException(_data.read('users', id));
dal.findOrderById = (id        )                  => parseNoException(_data.read('orders', id));
dal.findTokenById = (id        )                  => parseNoException(_data.read('tokens', id));
dal.findCartByUserId = (id        )                 => parseNoException(_data.read('carts', id));

dal.saveUser = (user      )                => _data.createOrUpdate('users', user.id, user);
dal.saveOrder = (order       )                => _data.createOrUpdate('orders', order.id, order);
dal.saveCart = (cart      , userId        )                => _data.createOrUpdate('carts', userId, cart);
dal.saveToken = (token       )                => _data.createOrUpdate('tokens', token.token, token);

dal.removeUser = (userId        )                => noException(_data.delete('users', userId));
dal.removeCart = (userId        )                => noException(_data.delete('carts', userId));
dal.removeToken = (token        )                => noException(_data.delete('tokens', token));


dal.readMenu = async () => _helpers.parseJsonToObject(await _data.read('', 'menu'))

dal.getAllOrders = async () => (await Promise.all((await _data.listFiles('orders'))
                                    .map(name => name.replace('.json', ''))
                                    .map(async id => await dal.findOrderById(id))))
                                    .filter(o=>o);

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