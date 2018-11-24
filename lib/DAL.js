// @flow
const _data = require('./data');
const _helpers = require('./helpers');
const _logger = require('./logger.js')('dal');

import type {User, Order, Token, Cart, MenuItem} from './entities'

const USERS_DIR = 'users';
const ORDERS_DIR = 'orders';
const TOKENS_DIR = 'tokens';
const CARTS_DIR = 'carts';
const LOGS_DIR = '.logs';
// initialize directories
_data.makeSureDirectoriesExist(USERS_DIR, ORDERS_DIR, TOKENS_DIR, CARTS_DIR, LOGS_DIR);

const dal = {};
dal.findUserById = (id: string): Promise<?User> => parseNoException(_data.read(USERS_DIR, id));
dal.findOrderById = (id: string): Promise<?Order> => parseNoException(_data.read(ORDERS_DIR, id));
dal.findTokenById = (id: string): Promise<?Token> => parseNoException(_data.read(TOKENS_DIR, id));
dal.findCartByUserId = (id: string): Promise<?Cart> => parseNoException(_data.read(CARTS_DIR, id));

dal.saveUser = (user: User): Promise<void> => _data.createOrUpdate(USERS_DIR, user.id, user);
dal.saveOrder = (order: Order): Promise<void> => _data.createOrUpdate(ORDERS_DIR, order.id, order);
dal.saveCart = (cart: Cart, userId: string): Promise<void> => _data.createOrUpdate(CARTS_DIR, userId, cart);
dal.saveToken = (token: Token): Promise<void> => _data.createOrUpdate(TOKENS_DIR, token.token, token);

dal.removeUser = (userId: string): Promise<void> => noException(_data.delete(USERS_DIR, userId));
dal.removeCart = (userId: string): Promise<void> => noException(_data.delete(CARTS_DIR, userId));
dal.removeToken = (token: string): Promise<void> => noException(_data.delete(TOKENS_DIR, token));

dal.removeLog = (fileName: string): Promise<void> => noException(_data.delete(LOGS_DIR, fileName));
dal.readLogContent = (fileName: string): Promise<?string> => noException(_data.read(LOGS_DIR, fileName));
dal.saveInLogsDir = (content: string, fileName: string): Promise<void> => _data.createOrUpdate(LOGS_DIR, fileName, content);

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
dal.readFileContent = async () => (await _data.read('.logs')).filter(f=>f.endsWith('.log'));

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