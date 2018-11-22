// @flow
const _data = require('./data');
const _helpers = require('./helpers');
const _logger = require('./logger.js');

import type {User, Order, Token, Cart, MenuItem} from './entities'

// initialize directories
_data.makeSureDirectoriesExist('users', 'orders', 'carts', 'tokens', '.logs');

const dal = {};
dal.findUserById = (id: string): Promise<?User> => parseNoException(_data.read('users', id));
dal.findOrderById = (id: string): Promise<?Order> => parseNoException(_data.read('orders', id));
dal.findTokenById = (id: string): Promise<?Token> => parseNoException(_data.read('tokens', id));
dal.findCartByUserId = (id: string): Promise<?Cart> => parseNoException(_data.read('carts', id));

dal.saveUser = (user: User): Promise<void> => _data.createOrUpdate('users', user.id, user);
dal.saveOrder = (order: Order): Promise<void> => _data.createOrUpdate('orders', order.id, order);
dal.saveCart = (cart: Cart, userId: string): Promise<void> => _data.createOrUpdate('carts', userId, cart);
dal.saveToken = (token: Token): Promise<void> => _data.createOrUpdate('tokens', token.token, token);

dal.removeUser = (userId: string): Promise<void> => noException(_data.delete('users', userId));
dal.removeCart = (userId: string): Promise<void> => noException(_data.delete('carts', userId));
dal.removeToken = (token: string): Promise<void> => noException(_data.delete('tokens', token));


dal.readMenu = async () => _helpers.parseJsonToObject(await _data.read('', 'menu'))

dal.getAllOrders = async () => (await Promise.all((await _data.listFiles('orders'))
                                    .map(name => name.replace('.json', ''))
                                    .map(async id => await dal.findOrderById(id))))
                                    .filter(o=>o);

async function parseNoException<T>(promise: Promise<string|false>):Promise<?T> {
    const result  = await noException(promise);
    return result? _helpers.parseJsonToObject(result) : undefined;
}

async function noException<T>(promise: Promise<T|void>) : Promise<T|void> {
        return promise.catch(e=>{
            _logger.error('exception was thrown, but will be muted by design', e);
        });
} 

module.exports = dal;