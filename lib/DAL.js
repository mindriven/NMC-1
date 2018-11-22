// @flow
const _data = require('./data');
const _helpers = require('./helpers');

import type {User, Order, Token, Cart} from './entities'

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

dal.deleteUser = (userId: string): Promise<void> => _data.delete('users', userId);
dal.deleteCart = (userId: string): Promise<void> => _data.delete('carts', userId);
dal.deleteToken = (token: string): Promise<void> => _data.delete('tokens', token);

module.exports = dal;