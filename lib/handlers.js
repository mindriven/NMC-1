// @flow

const _data = require('./data');
const _helpers = require('./helpers');
const https = require('https');
const querystring = require('querystring');


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

export type User = {|
    +id?: string,
    +email: string,
    +password: string,
    +firstName: string,
    +lastName: string,
    +tosAgreement: boolean
|};

export type Token = {
    expires: number,
    token: string,
    userId: string
}

type OrderPosition = {
    itemId:number,
    itemName: string,
    qty:number,
    grossPrice: number,
    netPrice: number,
    tax:number
};

type OrderTotals = {
    netPrice: number, 
    grossPrice: number,
    tax: number
};

type OrderStatus = 'created' | 'paid' | 'invoiceMailed';
type Order = {
    positions: OrderPosition[],
    totals: OrderTotals,
    userId: string,
    status: OrderStatus,
    chargeId: ?string
}

type MenuItem = {id: number, name: string, description: string, category: string, price: number};

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
                http201(_data.create('users', userId, user), userId))));
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
                http200(_data.update('users', userId, user)))));
        },
        delete: async (data: HandlerData) : Promise<HandlerResult<User>> => {
            return authenticate(data,
                (token, userId) => ifErrorBelowThen({code: 404},
                http200(_data.delete('users', userId))));
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
                http200WithPayload(_data.create('tokens', tokenObject.token, tokenObject), tokenObject))));
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
                http200WithPayload(_data.update('tokens', token, updatedTokenObject), updatedTokenObject)))));
        },
        delete: async (data: HandlerData) : Promise<HandlerResult<void>> => {
            return getTokenFromQs(data, token=>
                ifErrorBelowThen({code: 404},
                http200(_data.delete('tokens', token))));
        }
    },
    cart: async (data: HandlerData): Promise<HandlerResult<MenuItem[]>> => {
        const acceptableVerbs = ['post', 'get', 'delete'];
        return (acceptableVerbs.includes(data.method))
            ? handlers._cart[data.method](data)
            : Promise.resolve({code: 405});
    },
    _cart:{
        post: async (data: HandlerData): Promise<HandlerResult<number[]>> => {
            return authenticate(data, (token, userId) =>
                ifErrorBelowThen({code: 500},
                getMenuItemsIdsFromPayload(data, itemsIds => 
                getCartForUser(userId, cart =>
                http200(_data.createOrUpdate('carts', userId, [...cart, ...itemsIds]))))));
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
                http200(_data.update('carts', userId, cart.filter(id=>itemsIds.includes(id))))))));
        },
    },
    checkout: async (data: HandlerData): Promise<HandlerResult<string>> => {
        return (data.method!=='post')
            ? Promise.resolve({code: 405})
            : authenticate(data, (token, userId) =>
                ifErrorBelowThen({code: 500},
                getCartForUser(userId, cart =>
                // TODO archive old orders in a job
                createAndPersistOrder(cart, userId, orderId =>
                extractCardDataFromPayload(data, cardData =>
                chargeCard(cardData, orderId, chargeId =>
                updateOrderToPaid(orderId, chargeId,
                http201(_data.delete('carts', userId), orderId))))))));
    },
    orders: async (data: HandlerData): Promise<HandlerResult<Order>> => {
        return (data.method!=='get')
            ? Promise.resolve({code: 405})
            : authenticate(data, (token, userId) =>
                ifErrorBelowThen({code: 500},
                getOrderIdFromQs(data, orderId=>
                getOrderByIdForUser(orderId, userId, order => Promise.resolve({code: 200, payload: order})))));
    },
    test: async (data: HandlerData): Promise<HandlerResult<void>> => {
        return Promise.resolve({code: 200});
    },
    notFound: async (data: HandlerData) => Promise.resolve({code: 404})
};

type CardData = {
    number: string,
    exp_month: string,
    exp_year: string,
    cvc: string
};

async function extractCardDataFromPayload<T>(data: HandlerData, continueWith: CardData => Promise<HandlerResult<T>>): Promise<HandlerResult<T>>
{
    return getPayload(data, async payload => {
        const number = onlyDigitsOrFalse(payload.cardNumber, 16, 16);
        const exp_month = onlyDigitsOrFalse(payload.exp_month, 1, 2);
        const exp_year = onlyDigitsOrFalse(payload.exp_year, 4);
        const cvc = onlyDigitsOrFalse(payload.cvc, 3);
        return (number && exp_month && exp_year && cvc)
            ?continueWith({number, exp_year, exp_month, cvc})
            :{code: 400, error: 'missing required parameters'};
    });
}

async function readOrder(orderId: string): Promise<Order> {
    const order = _helpers.parseJsonToObject(await _data.read('orders', orderId));
    if(!order) throw new Error('no order for id' + orderId + 'found');
    return order;
}

async function updateOrderToPaid<T>(orderId: string, chargeId: string, continueWith: Promise<HandlerResult<T>>) : Promise<HandlerResult<T>>
{
    const order = _helpers.parseJsonToObject(await _data.read('orders', orderId));
    if(!order) return {code: 500};
    await _data.update('orders', orderId, {...order, chargeId, status:'paid'});
    return continueWith;
}

const onlyDigitsOrFalse = (input: string, minLen?: number, maxLen?: number) =>{
    const validated = inputOrFalse(input, minLen, maxLen);
    if(!validated) return false;
    return (/^\d+$/.test(validated))
        ?validated
        :false;
}

async function chargeCard<T>(cardData: CardData, orderId: string, continueWith: string => Promise<HandlerResult<T>>): Promise<HandlerResult<T>>
{
        //tokenize the card
        const cardToken = await getCardTokenOrFalse(cardData);
        if(!cardToken) return {code: 500};
        //charge the card
        const chargeId = await chargeCardOrFalse(cardToken, orderId);
        if(!chargeId) return {code: 500};

        return continueWith(chargeId);
}

async function getCardTokenOrFalse(cardData: CardData): Promise<string|false>{
    const requestData = `card[number]=${cardData.number}card[exp_month]=${cardData.exp_month}&card[exp_year]=${cardData.exp_year}&card[cvc]=${cardData.cvc}`;
    const options = getStripePostOptions('/v1/tokens', requestData);
    const rawResponse = await getResponseBodyAsString(options, requestData);
    if(!rawResponse) return false;
    const parsedResponse = _helpers.parseJsonToObject(rawResponse);
    if(!parsedResponse) return false;
    return parsedResponse.id || false;
    
};

async function chargeCardOrFalse<T>(cardToken: string, orderId: string): Promise<string|false>
{
    const order = await readOrder(orderId);
    const params = `amount=${order.totals.grossPrice}&currency=usd&description="Order number ${orderId}"&source=${cardToken}`;
    const options = getStripePostOptions('v1/charges', params);
    const rawResponse = await getResponseBodyAsString(options, params);
    if(!rawResponse) return false;
    const parsedResponse = _helpers.parseJsonToObject(rawResponse);
    if(!parsedResponse) return false;
    return parsedResponse.id || false;

}

async function getResponseBodyAsString(options: Object, requestData: string): Promise<string|false>{
    return new Promise((res, rej)=>{
        const req = https.request(options, resp => {
            let data = '';
            resp.on('data', chunk => {data += chunk;});
            resp.on('end', () => {
                console.log('got all the response', data);
                res(data);
            });
        });
    
        req.on('error', (e) => {
            console.log("Error during calling request with options", options, e);
            res(false);
        });
        req.write(requestData);
        req.end();
    });
}

function getStripePostOptions(path: string, requestData: string): Object{
    const options = {
        method: 'POST',
        host: 'api.stripe.com',
        path: path,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(requestData),
            //TODO move this to config
            'Authorization': 'Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc'
        }
    };
    return options;
}
async function getOrderByIdForUser(orderId: string, userId: string, continueWith: Order => Promise<HandlerResult<Order>>): Promise<HandlerResult<Order>>
{
    const order = _helpers.parseJsonToObject(await _data.read('orders', orderId));
    if(!order) return {code: 404};
    if(order.userId!==userId) return{code: 403};
    return continueWith(order);
}

async function getOrderIdFromQs(data: HandlerData, continueWith: string => Promise<HandlerResult<Order>>): Promise<HandlerResult<Order>>
{
    return getQS(data, async qs=>{
        const orderId = inputOrFalse(qs.orderId);
        if(!orderId) return {code: 400, error: 'Missing required fields'};
        return continueWith(orderId);
    });
}

async function createAndPersistOrder<T>(cart: number[], userId: string, continueWith: string => Promise<HandlerResult<T>>): Promise<HandlerResult<T>>
{    
    const productIdsUnique: number[] = cart.filter((value, index, self)=>self.indexOf(value) === index); 
    const menu = await getMenu();
    const orderPositions: OrderPosition[] = productIdsUnique.map(id=>{
        const menuItem = menu.find(menuItem => menuItem.id===id);
        if(!menuItem) return {itemId:id, itemName: 'product does no longer exist', qty:0, grossPrice:0, netPrice:0, tax:0};
        const qty = cart.filter(i=>i===id).length
        const taxRate = 0.23;// TODO move to config
        const grossPrice = qty*menuItem.price;
        const tax = grossPrice * taxRate;
        const netPrice = grossPrice - tax;
        return { itemId:id, itemName: menuItem.name, qty, grossPrice, netPrice, tax };
    });

    const totals = orderPositions.reduce((acc: OrderTotals, position: OrderPosition)=>{
        acc.netPrice+=position.netPrice;
        acc.tax += position.tax;
        acc.grossPrice += position.grossPrice;
        return acc;
    }, {netPrice: 0, grossPrice: 0, tax: 0});

    const order = {positions: orderPositions, totals, userId};
    const orderId = _helpers.createRandomString(20);
    if(!orderId) return {code:500};
    await _data.create('orders', orderId, order);
    return continueWith(orderId);

}

async function getCartForUser<T>(userId: string, continueWith: number[]=>Promise<HandlerResult<T>>): Promise<HandlerResult<T>>{
    let cart = [];
    try{
        cart = _helpers.parseJsonToObject(await _data.read('carts', userId)) || [];
    }
    catch(e){
        console.log('could not read cart for id', userId);
    }
    return continueWith(cart);
}

async function getMenuItemsIdsFromPayload<T>(data: HandlerData, continueWith: number[]=>Promise<HandlerResult<T>>) : Promise<HandlerResult<T>>{
    return getPayload(data, async payload =>{
        const sentIds : number[] = getIntsFromPayload(payload);
        const validMenuIds :number[] = (await getMenu()).map(item=>item.id);
        const validItemsMenuFromPayload :number[] = sentIds.filter(id=>validMenuIds.includes(id));
        console.log('getMenuItemsIdsFromPayload', validItemsMenuFromPayload, validMenuIds, sentIds);
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
    const parsedObject = _helpers.parseJsonToObject(await _data.read('', 'menu'));
    console.log('parsed menu', parsedObject);
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
    const tokenObject: ?Token = _helpers.parseJsonToObject(await _data.read('tokens', token));
    console.log('got token from db', tokenObject);
    if(!tokenObject) return {code: 404};
    if(tokenObject.expires<Date.now()){
        console.log('token is expired');
        _data.delete('tokens', token);
        return {code: 400, error: 'token expired'};
    }
    else
    {
        console.log('token object successfully read');
        return continueWith(tokenObject);
    }
}

const updateExpires = async (token: Token, continueWith: (updatedTokenObject: Token) => Promise<HandlerResult<Token>>) => {
    const updatedTokenObject = {...token, expires: newTokenExpirationDate()};
    await _data.update('tokens', token.token, updatedTokenObject);
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
        const user = _helpers.parseJsonToObject(await _data.read('users', userId));
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
        console.log('got user data from payload', user);
        return continueWith(user);
    });
}

async function authenticate<T>(data: HandlerData, continueWith : (token: string, userId: string) => Promise<HandlerResult<T>>): Promise<HandlerResult<T>>
{
    const token = inputOrFalse(data.headers.token, 20, 20);
    if(!token) return {code: 403, error: 'No token or token did not match'};
    try{
        const tokenObject = _helpers.parseJsonToObject(await _data.read('tokens', token));
        if(!tokenObject) return {code: 403, error: 'No token or token did not match'};
        const isValid = tokenObject &&  tokenObject.expires < Date.now();
        console.log('authenticated successfully');
        return continueWith(token, tokenObject.userId);
    }
    catch(e){return {code: 403, error: 'No token or token did not match'};}
}

const readUserObject = async (userId : string, continueWith: (user: User) => Promise<HandlerResult<User>>): Promise<HandlerResult<User>> =>
{
    const user = _helpers.parseJsonToObject(await _data.read('users', userId));
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

const getUserIfDataValid = (payload:Object): ?User => {
                const firstName = inputOrFalse(payload.firstName);
                const lastName = inputOrFalse(payload.lastName);
                const password = inputOrFalse(payload.password);
                const emailFromUser = inputOrFalse(payload.email);
                const email = emailFromUser?validEmailOrFalse(emailFromUser):false;
                const tosAgreement = payload.tosAgreement === true;
                const hashedPassword = password ? _helpers.hash(password): false;

                console.log('user data after validation:', {firstName ,  lastName ,  hashedPassword ,email, tosAgreement});
                if(firstName && lastName && hashedPassword && email && tosAgreement)
                {
                    return {
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

module.exports = handlers;