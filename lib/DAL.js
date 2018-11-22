// @flow
const _data = require('./data');
const _helpers = require('./helpers');
const _logger = require('./logger.js');

import type {User, Order, Token, Cart, MenuItem} from './entities'

// initialize directories
_data.makeSureDirectoriesExist('users', 'orders', 'carts', 'tokens', '.logs');

const dal = {};
dal.findUserById = async (id: string): Promise<?User> => _helpers.parseJsonToObject(await _data.read('users', id));
dal.findOrderById = async (id: string): Promise<?Order> => _helpers.parseJsonToObject(await _data.read('orders', id));
dal.findTokenById = async (id: string): Promise<?Token> => _helpers.parseJsonToObject(await _data.read('tokens', id));
dal.findCartByUserId = async (id: string): Promise<?Cart> => _helpers.parseJsonToObject(await _data.read('carts', id));

dal.saveUser = (user: User): Promise<void> => _data.createOrUpdate('users', user.id, user);
dal.saveOrder = (order: Order): Promise<void> => _data.createOrUpdate('orders', order.id, order);
dal.saveCart = (cart: Cart, userId: string): Promise<void> => _data.createOrUpdate('carts', userId, cart);
dal.saveToken = (token: Token): Promise<void> => _data.createOrUpdate('tokens', token.token, token);

dal.removeUser = (userId: string): Promise<void> => noException(_data.delete('users', userId));
dal.removeCart = (userId: string): Promise<void> => noException(_data.delete('carts', userId));
dal.removeToken = (token: string): Promise<void> => noException(_data.delete('tokens', token));


dal.readMenu = async () => _helpers.parseJsonToObject(await _data.read('', 'menu'))

const noException = async (promise: Promise<void>) => {
    try{
        await promise;
    }
    catch(e){
        _logger.error('exception was thrown, but will be muted by design', e);
    }
} 

module.exports = dal;