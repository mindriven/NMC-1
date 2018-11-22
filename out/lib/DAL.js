//      
const _data = require('./data');
const _helpers = require('./helpers');

                                                        

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

dal.deleteUser = (userId        )                => _data.delete('users', userId);
dal.deleteCart = (userId        )                => _data.delete('carts', userId);
dal.deleteToken = (token        )                => _data.delete('tokens', token);

module.exports = dal;