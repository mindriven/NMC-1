//      
const _data = require('./data');
const _helpers = require('./helpers');
const _logger = require('./logger.js');

                                                                  

// initialize directories
_data.makeSureDirectoriesExist('users', 'orders', 'carts', 'tokens', '.logs');

const dal = {};
dal.findUserById = async (id        )                 => _helpers.parseJsonToObject(await _data.read('users', id));
dal.findOrderById = async (id        )                  => _helpers.parseJsonToObject(await _data.read('orders', id));
dal.findTokenById = async (id        )                  => _helpers.parseJsonToObject(await _data.read('tokens', id));
dal.findCartByUserId = async (id        )                 => _helpers.parseJsonToObject(await _data.read('carts', id));

dal.saveUser = (user      )                => _data.createOrUpdate('users', user.id, user);
dal.saveOrder = (order       )                => _data.createOrUpdate('orders', order.id, order);
dal.saveCart = (cart      , userId        )                => _data.createOrUpdate('carts', userId, cart);
dal.saveToken = (token       )                => _data.createOrUpdate('tokens', token.token, token);

dal.removeUser = (userId        )                => noException(_data.delete('users', userId));
dal.removeCart = (userId        )                => noException(_data.delete('carts', userId));
dal.removeToken = (token        )                => noException(_data.delete('tokens', token));


dal.readMenu = async () => _helpers.parseJsonToObject(await _data.read('', 'menu'))

const noException = async (promise               ) => {
    try{
        await promise;
    }
    catch(e){
        _logger.error('exception was thrown, but will be muted by design', e);
    }
} 

module.exports = dal;