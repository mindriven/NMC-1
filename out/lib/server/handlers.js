//      

const _helpers = require('../helpers');
const _logger = require('../logger');
const querystring = require('querystring');
const _config = require('../configs');
const _dal = require('../DAL');

                                                                                               

                           
                        
                              
                   
                    
                    
  

                                
                 
                   
               
  


                 
                   
                      
                     
               
  

const handlers = {
    ping: async () => Promise.resolve({code: 200}),
    menu: async(data             )                                     => {
        return data.method==='get'
            ? ifErrorBelowThen({code: 500}, Promise.resolve({code: 200, payload: await getMenu()}))
            : Promise.resolve({code: 405});
    },
    users: async (data             )                                      => {
        const acceptableVerbs = ['post', 'get', 'put', 'delete'];
        return acceptableVerbs.includes(data.method)
            ? handlers._users[data.method](data)
            : Promise.resolve({code: 405});
    },
    _users: {
        post: async (data             )                                 => {
            return getUserDataFromPayload(data, user =>
                ifErrorBelowThen({code: 400, error: 'User already exists'},
                createNewId(20, userId =>
                http201(_dal.saveUser({...user, id: userId}), userId))));
        },
        get: async (data             )                               => {
            return authenticate(data,
                (token, userId) => ifErrorBelowThen({code: 404},
                readUserObject(userId, 
                (user)=>{delete user.password; return Promise.resolve({code: 200, payload: user})})));
        },
        put: async (data             )                                => {
            return authenticate(data,
                (token, userId) => getUserDataFromPayload(data,
                user => ifErrorBelowThen({code: 404},
                http200(_dal.saveUser({...user, id: userId})))));
        },
        delete: async (data             )                                => {
            return authenticate(data,
                (token, userId) => ifErrorBelowThen({code: 404},
                http200(Promise.all([_dal.removeCart(userId),
                                    _dal.removeToken(token),
                                    _dal.removeUser(userId)
                                    ]))));
        },
    },
    tokens: async (data             )                                => {
        const acceptableVerbs = ['post', 'get', 'put', 'delete'];
        return (acceptableVerbs.includes(data.method))
            ? handlers._tokens[data.method](data)
            : Promise.resolve({code: 405});
    },
    _tokens: {
        post: async (data             )                                => {
            return getExistingUserObjectByQsIdAndPayloadPassword(data, (user, userId) =>
                createNewToken(userId, tokenObject =>
                ifErrorBelowThen({code: 500, error: 'couldn\'t persist token'},
                http200WithPayload(_dal.saveToken(tokenObject), tokenObject))));
        },
        get: async (data             )                                 => {
            return getTokenFromQs(data, token =>
                    ifErrorBelowThen({code: 404},
                    readTokenObject(token, tokenObject => Promise.resolve({code: 200, payload: tokenObject}))));
        },
        put: async (data             )                                 => {
            return getTokenFromQs(data, token =>
                ifErrorBelowThen({code: 404},
                readTokenObject(token, oldTokenObject =>
                updateExpires(oldTokenObject, updatedTokenObject =>
                http200WithPayload(_dal.saveToken(updatedTokenObject), updatedTokenObject)))));
        },
        delete: async (data             )                                => {
            return getTokenFromQs(data, token=>
                ifErrorBelowThen({code: 404},
                http200(_dal.removeToken(token))));
        }
    },
    cart: async (data             )                                     => {
        const acceptableVerbs = ['post', 'get', 'delete'];
        return (acceptableVerbs.includes(data.method))
            ? handlers._cart[data.method](data)
            : Promise.resolve({code: 405});
    },
    _cart:{
        post: async (data             )                               => {
            return authenticate(data, (token, userId) =>
                ifErrorBelowThen({code: 500},
                getMenuItemsIdsFromPayload(data, itemsIds => 
                getCartForUser(userId, cart =>
                http200(_dal.saveCart([...cart, ...itemsIds], userId))))));
        }
        ,
        get: async (data             )                                   => {
            return authenticate(data, (token, userId) =>
                ifErrorBelowThen({code: 500},
                getCartForUser(userId, cart => Promise.resolve({code: 200, payload: cart}))));
        },
        delete: async (data             )                                   => {
            return authenticate(data, (token, userId) =>
                ifErrorBelowThen({code: 500},
                getMenuItemsIdsFromPayload(data, itemsIds => 
                getCartForUser(userId, cart =>
                http200(_dal.saveCart(cart.filter(id=>itemsIds.includes(id)), userId))))));
        },
    },
    checkout: async (data             )                                 => {
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
    orders: async (data             )                                => {
        return (data.method!=='get')
            ? Promise.resolve({code: 405})
            : authenticate(data, (token, userId) =>
                ifErrorBelowThen({code: 500},
                getOrderIdFromQs(data, orderId=>
                getOrderByIdForUser(orderId, userId, order => Promise.resolve({code: 200, payload: order})))));
    },
    notFound: async (data             )                               => Promise.resolve({code: 404})
};

async function extractCardDataFromPayload   (data             , continueWith                                       )                           
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

async function readOrder(orderId        )                 {
    const order = await _dal.findOrderById(orderId);
    if(!order) throw new Error('no order for id' + orderId + 'found');
    return order;
}

async function updateOrderToPaid   (orderId        , chargeId        , continueWith                           )                            
{
    const order = await _dal.findOrderById(orderId);
    if(!order) return {code: 500};
    await _dal.saveOrder({...order, chargeId, status:'paid'});
    return continueWith;
}

async function chargeCard   (cardData          , orderId        , continueWith                                     )                           
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

async function getCardTokenOrFalse(cardData          )                       {
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

async function chargeCardOrFalse   (cardToken        , orderId        )                       
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

function getStripePostOptions(path        , requestData        )        {
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

async function getOrderByIdForUser(orderId        , userId        , continueWith                                        )                               
{
    const order = await _dal.findOrderById(orderId);
    if(!order) return {code: 404};
    if(order.userId!==userId) return{code: 403};
    return continueWith(order);
}

async function getOrderIdFromQs(data             , continueWith                                         )                               
{
    return getQS(data, async qs=>{
        const orderId = inputOrFalse(qs.orderId);
        if(!orderId) return {code: 400, error: 'Missing required fields'};
        _logger.trace('read order id from query string '+orderId);
        return continueWith(orderId);
    });
}

async function createAndPersistOrder   (cart          , userId        , continueWith                                    )                           
{    _logger.trace('creating order for user '+userId);
    const productIdsUnique           = cart.filter((value, index, self)=>self.indexOf(value) === index); 
    const menu = await getMenu();
    const orderId = _helpers.createRandomString(20);
    if(!orderId) return {code:500};
    const orderPositions                  = productIdsUnique.map(id=>{
        const menuItem = menu.find(menuItem => menuItem.id===id);
        if(!menuItem) return {itemId:id, itemName: 'product does no longer exist', qty:0, grossPrice:0, netPrice:0, tax:0};
        const qty = cart.filter(i=>i===id).length
        const taxRate = _config.taxRate;
        const grossPrice = (qty*menuItem.price).toFixed(2);
        const tax = (grossPrice * taxRate).toFixed(2);
        const netPrice = (grossPrice - tax).toFixed(2);
        return { itemId:id, itemName: menuItem.name, qty, grossPrice, netPrice, tax };
    });

    const totals = orderPositions.reduce((acc             , position               )=>{
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

async function getCartForUser   (userId        , continueWith                                     )                           {
    let cart = [];
    try{
        cart = await _dal.findCartByUserId(userId) || [];
    }
    catch(e){
        _logger.error('could not read cart for id ' + userId);
    }
    return continueWith(cart);
}

async function getMenuItemsIdsFromPayload   (data             , continueWith                                     )                            {
    return getPayload(data, async payload =>{
        const sentIds            = getIntsFromPayload(payload);
        const validMenuIds           = (await getMenu()).map(item=>item.id);
        const validItemsMenuFromPayload           = sentIds.filter(id=>validMenuIds.includes(id));
        if(!validItemsMenuFromPayload.length) return {code: 400, error:'no valid menu items ids found'}
        return continueWith(validItemsMenuFromPayload);
    });
}

const getIntsFromPayload = (payload        )            =>
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

const parseMenuItem = (item        )            => {
    const id = inputOrFalse(item.id);
    const name = inputOrFalse(item.name);
    const description = inputOrFalse(item.description);
    const category = inputOrFalse(item.category);
    const price = item.price;

    return (id && Number.parseInt(id) && name && description && category && price)
            ? {id: Number.parseInt(id), name, description, category, price}
            : undefined;
}

const readTokenObject = async (token        , continueWith                                                              ) => {
    const tokenObject         = await _dal.findTokenById(token);
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

const updateExpires = async (token       , continueWith                                                              ) => {
    const updatedTokenObject = {...token, expires: newTokenExpirationDate()};
    await _dal.saveToken(updatedTokenObject);
    return continueWith(updatedTokenObject);
}

async function getTokenFromQs   (data             , continueWith                                            )                           
{
    return getQS(data, async qs=>{
        const token = inputOrFalse(qs.token, 10);
        if(!token) return {code: 400, error: 'Missing required fields'};
        return continueWith(token);
    })
}

async function getPayload   (data             , continueWith                                   )                            
{
    const payload = data.payload;
    if(!payload) return {code: 400, error: 'Missing required fields'};
    return continueWith(payload);
}

async function getQS   (data             , continueWith                                   )                            
{
    const qs = data.queryStringObject;
    if(!qs) return {code: 400, error: 'Missing required fields'};
    return continueWith(qs);
}

async function getPayloadAndQs   (data             , continueWith                                               )                            
{
    return getPayload(data, async payload=> getQS(data, async qs=>continueWith(payload, qs)));
}


const getExistingUserObjectByQsIdAndPayloadPassword = async (data             , continueWith                                                                )                                => {
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

const createNewToken = async(userId        , continueWith                                        )=>{
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

async function createNewId   (length        , continueWith                                       )                            {
    const newId = _helpers.createRandomString(length);
    if(!newId) return Promise.resolve({code: 500, error: 'couldn\'t generate an id'});
    return continueWith(newId);
}

async function getUserDataFromPayload   (data             , continueWith                                    )                           
{
    return getPayload(data, async payload => {
        const user = getUserIfDataValid(payload);
        if (!user) return {code: 400, error: 'Missing required fields'};
        _logger.trace('got user data from payload', user);
        return continueWith(user);
    });
}

async function authenticate   (data             , continueWith                                                               )                           
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

const readUserObject = async (userId         , continueWith                                              )                               =>
{
    const user = await _dal.findUserById(userId);
    if(!user) return {code: 404};
    return continueWith(user);
}

async function ifErrorBelowThen   (onError                  , continueWith                           )                           
{
    return continueWith.catch(e=>onError);
}

async function http200       (p             )                           
{
    await p;
    return { code : 200 };
}

async function http200WithPayload       (p             , payload   )                           
{
    await p;
    return { code : 200, payload };
}

async function http201       (p             , payload   )                           
{
    await p;
    return { code : 201, payload };
}

const getUserIfDataValid = (payload       )                => {
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

const inputOrFalse = (input        , minLen         = 1, maxLen         = 255) =>
    (typeof (input) === 'string' && input.trim().length >= minLen && input.trim().length <= maxLen)
        ? input.trim()
        : false;

const validEmailOrFalse = (input        ) => {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(input.toLowerCase())
        ? input.toLowerCase()
        : false;
};

const onlyDigitsOrFalse = (input        , minLen         , maxLen         ) =>{
    const validated = inputOrFalse(input, minLen, maxLen);
    if(!validated) return false;
    return (/^\d+$/.test(validated))
        ?validated
        :false;
}

module.exports = handlers;