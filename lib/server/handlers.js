// @flow

const _helpers = require('../helpers');
const _logger = require('../logger');
const querystring = require('querystring');
const _config = require('../configs');
const _dal = require('../DAL');

import type {User, Order, Token, Cart, MenuItem, OrderPosition, OrderTotals} from '../entities'

export type HandlerData = {
    trimmedPath: string,
    queryStringObject: Object,
    method: string,
    headers: Object,
    payload: ?Object
};

export type HandlerResult<T> = {
    code: number,
    error?: string,
    payload?: T
};


type CardData = {
    number: string,
    exp_month: string,
    exp_year: string,
    cvc: string
};

const handlers = {
    ping: async () => Promise.resolve({code: 200}),
    menu: async(data: HandlerData): Promise<HandlerResult<MenuItem[]>> => {
        return data.method==='get'
            ? ifErrorBelowThen({code: 500}, Promise.resolve({code: 200, payload: await getMenu()}))
            : Promise.resolve({code: 405});
    },
    users: async (data: HandlerData): Promise<HandlerResult<User|string>> => {
        const acceptableVerbs = ['post', 'get', 'put', 'delete'];
        return acceptableVerbs.includes(data.method)
            ? handlers._users[data.method](data)
            : Promise.resolve({code: 405});
    },
    _users: {
        post: async (data: HandlerData): Promise<HandlerResult<string>> => {
            return getUserDataFromPayload(data, user =>
                ifErrorBelowThen({code: 400, error: 'User already exists'},
                createNewId(20, userId =>
                http201(_dal.saveUser({...user, id: userId}), userId))));
        },
        get: async (data: HandlerData): Promise<HandlerResult<User>> => {
            return authenticate(data,
                (token, userId) => ifErrorBelowThen({code: 404},
                readUserObject(userId, 
                (user)=>{delete user.password; return Promise.resolve({code: 200, payload: user})})));
        },
        put: async (data: HandlerData) : Promise<HandlerResult<User>> => {
            return authenticate(data,
                (token, userId) => getUserDataFromPayload(data,
                user => ifErrorBelowThen({code: 404},
                http200(_dal.saveUser({...user, id: userId})))));
        },
        delete: async (data: HandlerData) : Promise<HandlerResult<User>> => {
            return authenticate(data,
                (token, userId) => ifErrorBelowThen({code: 404},
                http200(Promise.all([_dal.removeCart(userId),
                                    _dal.removeToken(token),
                                    _dal.removeUser(userId)
                                    ]))));
        },
    },
    tokens: async (data: HandlerData): Promise<HandlerResult<Token>> => {
        const acceptableVerbs = ['post', 'get', 'put', 'delete'];
        return (acceptableVerbs.includes(data.method))
            ? handlers._tokens[data.method](data)
            : Promise.resolve({code: 405});
    },
    _tokens: {
        post: async (data: HandlerData): Promise<HandlerResult<Token>> => {
            return getExistingUserObjectByQsIdAndPayloadPassword(data, (user, userId) =>
                createNewToken(userId, tokenObject =>
                ifErrorBelowThen({code: 500, error: 'couldn\'t persist token'},
                http200WithPayload(_dal.saveToken(tokenObject), tokenObject))));
        },
        get: async (data: HandlerData) : Promise<HandlerResult<Token>> => {
            return getTokenFromQs(data, token =>
                    ifErrorBelowThen({code: 404},
                    readTokenObject(token, tokenObject => Promise.resolve({code: 200, payload: tokenObject}))));
        },
        put: async (data: HandlerData) : Promise<HandlerResult<Token>> => {
            return getTokenFromQs(data, token =>
                ifErrorBelowThen({code: 404},
                readTokenObject(token, oldTokenObject =>
                updateExpires(oldTokenObject, updatedTokenObject =>
                http200WithPayload(_dal.saveToken(updatedTokenObject), updatedTokenObject)))));
        },
        delete: async (data: HandlerData) : Promise<HandlerResult<void>> => {
            return getTokenFromQs(data, token=>
                ifErrorBelowThen({code: 404},
                http200(_dal.removeToken(token))));
        }
    },
    cart: async (data: HandlerData): Promise<HandlerResult<MenuItem[]>> => {
        const acceptableVerbs = ['post', 'get', 'delete'];
        return (acceptableVerbs.includes(data.method))
            ? handlers._cart[data.method](data)
            : Promise.resolve({code: 405});
    },
    _cart:{
        post: async (data: HandlerData): Promise<HandlerResult<Cart>> => {
            return authenticate(data, (token, userId) =>
                ifErrorBelowThen({code: 500},
                getMenuItemsIdsFromPayload(data, itemsIds => 
                getCartForUser(userId, cart =>
                http200(_dal.saveCart([...cart, ...itemsIds], userId))))));
        }
        ,
        get: async (data: HandlerData): Promise<HandlerResult<number[]>> => {
            return authenticate(data, (token, userId) =>
                ifErrorBelowThen({code: 500},
                getCartForUser(userId, cart => Promise.resolve({code: 200, payload: cart}))));
        },
        delete: async (data: HandlerData): Promise<HandlerResult<number[]>> => {
            return authenticate(data, (token, userId) =>
                ifErrorBelowThen({code: 500},
                getMenuItemsIdsFromPayload(data, itemsIds => 
                getCartForUser(userId, cart =>
                http200(_dal.saveCart(cart.filter(id=>itemsIds.includes(id)), userId))))));
        },
    },
    checkout: async (data: HandlerData): Promise<HandlerResult<string>> => {
        return (data.method!=='post')
            ? Promise.resolve({code: 405})
            : authenticate(data, (token, userId) =>
                ifErrorBelowThen({code: 500},
                getCartForUser(userId, cart =>
                createAndPersistOrder(cart, userId, order =>
                extractCardDataFromPayload(data, cardData =>
                chargeCard(cardData, order.id, chargeId =>
                updateOrderToPaid(order.id, chargeId,
                http201(_dal.removeCart(userId), order.id))))))));
    },
    orders: async (data: HandlerData): Promise<HandlerResult<Order>> => {
        return (data.method!=='get')
            ? Promise.resolve({code: 405})
            : authenticate(data, (token, userId) =>
                ifErrorBelowThen({code: 500},
                getOrderIdFromQs(data, orderId=>
                getOrderByIdForUser(orderId, userId, order => Promise.resolve({code: 200, payload: order})))));
    },
    notFound: async (data: HandlerData): Promise<HandlerResult<void>> => Promise.resolve({code: 404})
};

async function extractCardDataFromPayload<T>(data: HandlerData, continueWith: CardData => Promise<HandlerResult<T>>): Promise<HandlerResult<T>>
{
    return getPayload(data, async payload => {
        _logger.trace('will parse user card data from payload');
        const number = onlyDigitsOrFalse(payload.number, 16, 16);
        const exp_month = onlyDigitsOrFalse(payload.exp_month, 1, 2);
        const exp_year = onlyDigitsOrFalse(payload.exp_year, 4);
        const cvc = onlyDigitsOrFalse(payload.cvc, 3);
        _logger.trace('card data after validation '+ JSON.stringify( {number, exp_year, exp_month, cvc}));
        return (number && exp_month && exp_year && cvc)
            ? continueWith( {number, exp_year, exp_month, cvc})
            : {code: 400, error: 'missing required parameters'};
    });
}

async function readOrder(orderId: string): Promise<Order> {
    const order = await _dal.findOrderById(orderId);
    if(!order) throw new Error('no order for id' + orderId + 'found');
    return order;
}

async function updateOrderToPaid<T>(orderId: string, chargeId: string, continueWith: Promise<HandlerResult<T>>) : Promise<HandlerResult<T>>
{
    const order = await _dal.findOrderById(orderId);
    if(!order) return {code: 500};
    await _dal.saveOrder({...order, chargeId, status:'paid'});
    return continueWith;
}

async function chargeCard<T>(cardData: CardData, orderId: string, continueWith: string => Promise<HandlerResult<T>>): Promise<HandlerResult<T>>
{
        _logger.trace('will attempt to charge card');
        //tokenize the card
        const cardToken = await getCardTokenOrFalse(cardData);
        if(!cardToken) return {code: 500};
        //charge the card
        const chargeId = await chargeCardOrFalse(cardToken, orderId);
        if(!chargeId) return {code: 500};

        return continueWith(chargeId);
}

async function getCardTokenOrFalse(cardData: CardData): Promise<string|false>{
    _logger.trace('will try to tokenize card data');
    const requestData =  _helpers.encodePostData({
        'card[number]':cardData.number,
        'card[exp_month]':cardData.exp_month,
        'card[exp_year]': cardData.exp_year,
        'card[cvc]':cardData.cvc
    });
    const options = getStripePostOptions('/v1/tokens', requestData);
    const rawResponse = await _helpers.getResponseBodyAsString(options, requestData);
    if(!rawResponse) return false;
    const parsedResponse = _helpers.parseJsonToObject(rawResponse);
    if(!parsedResponse) return false;
    return parsedResponse.id || false;
    
};

async function chargeCardOrFalse<T>(cardToken: string, orderId: string): Promise<string|false>
{
    const order = await readOrder(orderId);
    const params = _helpers.encodePostData({
        amount: order.totals.grossPrice*100,
        currency: 'usd',
        description: 'Order number ${orderId}',
        source: cardToken
    });
    const options = getStripePostOptions('/v1/charges', params);
    const rawResponse = await _helpers.getResponseBodyAsString(options, params);
    if(!rawResponse) return false;
    const parsedResponse = _helpers.parseJsonToObject(rawResponse);
    if(!parsedResponse) return false;
    return parsedResponse.id || false;

}

function getStripePostOptions(path: string, requestData: string): Object{
    const options = {
        method: 'POST',
        host: 'api.stripe.com',
        path: path,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(requestData),
            'Authorization': 'Bearer '+_config.stripeApiKey
        }
    };
    return options;
}

async function getOrderByIdForUser(orderId: string, userId: string, continueWith: Order => Promise<HandlerResult<Order>>): Promise<HandlerResult<Order>>
{
    const order = await _dal.findOrderById(orderId);
    if(!order) return {code: 404};
    if(order.userId!==userId) return{code: 403};
    return continueWith(order);
}

async function getOrderIdFromQs(data: HandlerData, continueWith: string => Promise<HandlerResult<Order>>): Promise<HandlerResult<Order>>
{
    return getQS(data, async qs=>{
        const orderId = inputOrFalse(qs.orderId);
        if(!orderId) return {code: 400, error: 'Missing required fields'};
        _logger.trace('read order id from query string '+orderId);
        return continueWith(orderId);
    });
}

async function createAndPersistOrder<T>(cart: number[], userId: string, continueWith: Order => Promise<HandlerResult<T>>): Promise<HandlerResult<T>>
{    _logger.trace('creating order for user '+userId);
    const productIdsUnique: number[] = cart.filter((value, index, self)=>self.indexOf(value) === index); 
    const menu = await getMenu();
    const orderId = _helpers.createRandomString(20);
    if(!orderId) return {code:500};
    const orderPositions: OrderPosition[] = productIdsUnique.map(id=>{
        const menuItem = menu.find(menuItem => menuItem.id===id);
        if(!menuItem) return {itemId:id, itemName: 'product does no longer exist', qty:0, grossPrice:0, netPrice:0, tax:0};
        const qty = cart.filter(i=>i===id).length
        const taxRate = _config.taxRate;
        const grossPrice = (qty*menuItem.price).toFixed(2);
        const tax = (grossPrice * taxRate).toFixed(2);
        const netPrice = (grossPrice - tax).toFixed(2);
        return { itemId:id, itemName: menuItem.name, qty, grossPrice, netPrice, tax };
    });

    const totals = orderPositions.reduce((acc: OrderTotals, position: OrderPosition)=>{
        acc.netPrice+=position.netPrice;
        acc.tax += position.tax;
        acc.grossPrice += position.grossPrice;
        return acc;
    }, {netPrice: 0, grossPrice: 0, tax: 0});

    const order = {positions: orderPositions, totals, userId, status: 'created', id: orderId, createdAt: new Date()};
    await _dal.saveOrder(order);
    _logger.trace('created new order for user '+userId+ ', order id is '+orderId);
    return continueWith(order);

}

async function getCartForUser<T>(userId: string, continueWith: number[]=>Promise<HandlerResult<T>>): Promise<HandlerResult<T>>{
    let cart = [];
    try{
        cart = await _dal.findCartByUserId(userId) || [];
    }
    catch(e){
        _logger.error('could not read cart for id ' + userId);
    }
    return continueWith(cart);
}

async function getMenuItemsIdsFromPayload<T>(data: HandlerData, continueWith: number[]=>Promise<HandlerResult<T>>) : Promise<HandlerResult<T>>{
    return getPayload(data, async payload =>{
        const sentIds : number[] = getIntsFromPayload(payload);
        const validMenuIds :number[] = (await getMenu()).map(item=>item.id);
        const validItemsMenuFromPayload :number[] = sentIds.filter(id=>validMenuIds.includes(id));
        if(!validItemsMenuFromPayload.length) return {code: 400, error:'no valid menu items ids found'}
        return continueWith(validItemsMenuFromPayload);
    });
}

const getIntsFromPayload = (payload: Object) : number[] =>
{
    if(typeof payload === 'number') return [Number.parseInt(payload)];
    if(payload instanceof Array) return payload.map(id=>Number.isInteger(id)?id:undefined).filter(id=>id);
    return [];
}

const getMenu = async () =>{
    const parsedObject = await _dal.readMenu();
    _logger.debug('parsed menu');
    _logger.trace('parsed menu content', parsedObject);
    if(!parsedObject || !(parsedObject instanceof Array)) throw new Error('menu has a wrong format');
    const items = parsedObject.map(item=>(parseMenuItem(item))).filter(i=>i);
    return items;
};

const parseMenuItem = (item: Object): ?MenuItem => {
    const id = inputOrFalse(item.id);
    const name = inputOrFalse(item.name);
    const description = inputOrFalse(item.description);
    const category = inputOrFalse(item.category);
    const price = item.price;

    return (id && Number.parseInt(id) && name && description && category && price)
            ? {id: Number.parseInt(id), name, description, category, price}
            : undefined;
}

const readTokenObject = async (token: string, continueWith: (updatedTokenObject: Token) => Promise<HandlerResult<Token>>) => {
    const tokenObject: ?Token = await _dal.findTokenById(token);
    if(!tokenObject) return {code: 404};
    if(tokenObject.expires<Date.now()){
        _logger.trace('token with id '+token+' is expired');
        await _dal.removeToken(token);
        return {code: 400, error: 'token expired'};
    }
    else
    {
        _logger.trace('token object successfully read');
        return continueWith(tokenObject);
    }
}

const updateExpires = async (token: Token, continueWith: (updatedTokenObject: Token) => Promise<HandlerResult<Token>>) => {
    const updatedTokenObject = {...token, expires: newTokenExpirationDate()};
    await _dal.saveToken(updatedTokenObject);
    return continueWith(updatedTokenObject);
}

async function getTokenFromQs<T>(data: HandlerData, continueWith: (token: string)=>Promise<HandlerResult<T>>): Promise<HandlerResult<T>>
{
    return getQS(data, async qs=>{
        const token = inputOrFalse(qs.token, 10);
        if(!token) return {code: 400, error: 'Missing required fields'};
        return continueWith(token);
    })
}

async function getPayload<T>(data: HandlerData, continueWith: Object=>Promise<HandlerResult<T>>) : Promise<HandlerResult<T>>
{
    const payload = data.payload;
    if(!payload) return {code: 400, error: 'Missing required fields'};
    return continueWith(payload);
}

async function getQS<T>(data: HandlerData, continueWith: Object=>Promise<HandlerResult<T>>) : Promise<HandlerResult<T>>
{
    const qs = data.queryStringObject;
    if(!qs) return {code: 400, error: 'Missing required fields'};
    return continueWith(qs);
}

async function getPayloadAndQs<T>(data: HandlerData, continueWith: (Object, Object) => Promise<HandlerResult<T>>) : Promise<HandlerResult<T>>
{
    return getPayload(data, async payload=> getQS(data, async qs=>continueWith(payload, qs)));
}


const getExistingUserObjectByQsIdAndPayloadPassword = async (data: HandlerData, continueWith : (user: User, userId: string) => Promise<HandlerResult<Token>>): Promise<HandlerResult<Token>> => {
    return getPayloadAndQs(data, async (payload, qs)=>{   
        const password = inputOrFalse(payload.password);
        const userId = inputOrFalse(qs.userId, 10);
        if (!password || !userId) return {code: 400, error: 'Missing required fields'};
        const user = await _dal.findUserById(userId);
        const inputPasswordHash = _helpers.hash(password);
        if(!user || user.password !== inputPasswordHash) return {code: 404};
        return continueWith(user, userId);
    });
}

const createNewToken = async(userId: string, continueWith: Token => Promise<HandlerResult<Token>>)=>{
    const token = _helpers.createRandomString(20);
    if(!token) return {code: 500, error: 'error generating auth token'};

    const tokenObject = {
        expires: newTokenExpirationDate(),
        token,
        userId
    };

    return continueWith(tokenObject);
}

const newTokenExpirationDate = () => Date.now() + 1000 * 60 * 60;

async function createNewId<T>(length: number, continueWith: (string => Promise<HandlerResult<T>>)): Promise<HandlerResult<T>> {
    const newId = _helpers.createRandomString(length);
    if(!newId) return Promise.resolve({code: 500, error: 'couldn\'t generate an id'});
    return continueWith(newId);
}

async function getUserDataFromPayload<T>(data: HandlerData, continueWith : User => Promise<HandlerResult<T>>): Promise<HandlerResult<T>>
{
    return getPayload(data, async payload => {
        const user = getUserIfDataValid(payload);
        if (!user) return {code: 400, error: 'Missing required fields'};
        _logger.trace('got user data from payload', user);
        return continueWith(user);
    });
}

async function authenticate<T>(data: HandlerData, continueWith : (token: string, userId: string) => Promise<HandlerResult<T>>): Promise<HandlerResult<T>>
{
    const token = inputOrFalse(data.headers.token, 20, 20);
    if(!token) return {code: 403, error: 'No token or token did not match'};
    try{
        const tokenObject = await _dal.findTokenById(token);
        if(!tokenObject) return {code: 403, error: 'No token or token did not match'};
        const isValid = tokenObject && tokenObject.expires >= Date.now();
        if(!isValid) return {code: 403, error: 'No token or token did not match'};
        _logger.trace('authenticated successfully user with id ' + tokenObject.userId + ' token is '+token);
        return continueWith(token, tokenObject.userId);
    }
    catch(e){return {code: 403, error: 'No token or token did not match'};}
}

const readUserObject = async (userId : string, continueWith: (user: User) => Promise<HandlerResult<User>>): Promise<HandlerResult<User>> =>
{
    const user = await _dal.findUserById(userId);
    if(!user) return {code: 404};
    return continueWith(user);
}

async function ifErrorBelowThen<T>(onError: HandlerResult<T>, continueWith: Promise<HandlerResult<T>>): Promise<HandlerResult<T>>
{
    return continueWith.catch(e=>onError);
}

async function http200<T, V> (p: Promise<?T>): Promise<HandlerResult<V>>
{
    await p;
    return { code : 200 };
}

async function http200WithPayload<T, V> (p: Promise<?V>, payload: T): Promise<HandlerResult<T>>
{
    await p;
    return { code : 200, payload };
}

async function http201<T, V> (p: Promise<?V>, payload: T): Promise<HandlerResult<T>>
{
    await p;
    return { code : 201, payload };
}

const getUserIfDataValid = (payload:Object): ?$Shape<User> => {
                const firstName = inputOrFalse(payload.firstName);
                const lastName = inputOrFalse(payload.lastName);
                const password = inputOrFalse(payload.password);
                const emailFromUser = inputOrFalse(payload.email);
                const email = emailFromUser?validEmailOrFalse(emailFromUser):false;
                const tosAgreement = payload.tosAgreement === true;
                const hashedPassword = password ? _helpers.hash(password): false;

                if(firstName && lastName && hashedPassword && email && tosAgreement)
                {
                    return {
                        createdAt:new Date(),
                        firstName,
                        lastName,
                        email,
                        password: hashedPassword,
                        tosAgreement
                    }
                }
                else return undefined;
            };

const inputOrFalse = (input: string, minLen: number = 1, maxLen: number = 255) =>
    (typeof (input) === 'string' && input.trim().length >= minLen && input.trim().length <= maxLen)
        ? input.trim()
        : false;

const validEmailOrFalse = (input: string) => {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(input.toLowerCase())
        ? input.toLowerCase()
        : false;
};

const onlyDigitsOrFalse = (input: string, minLen?: number, maxLen?: number) =>{
    const validated = inputOrFalse(input, minLen, maxLen);
    if(!validated) return false;
    return (/^\d+$/.test(validated))
        ?validated
        :false;
}

module.exports = handlers;