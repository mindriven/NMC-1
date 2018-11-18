// @flow
const _data = require('./data');
const _helpers = require('./helpers');


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

type MenuItem = {id: string, name: string, description: string, category: string, price: number};
type Menu = MenuItem [];

const handlers = {
    ping: async () => Promise.resolve({code: 200}),
    menu: async(data: HandlerData): Promise<HandlerResult<Menu>> => {
        return data.method==='get'
            ? getMenu()
            : Promise.resolve({code: 405});
    },
    users: async (data: HandlerData): Promise<HandlerResult<User>> => {
        const acceptableVerbs = ['post', 'get', 'put', 'delete'];
        return acceptableVerbs.includes(data.method)
            ? handlers._users[data.method](data)
            : Promise.resolve({code: 405});
    },
    _users: {
        post: async (data: HandlerData) => {
            return getUserDataFromPayload(data, user =>
                ifErrorBelowThen({code: 400, error: 'User already exists'},
                createNewId(20, userId =>
                http200WithPayload(_data.create('users', userId, user), {...user, id: userId}))));
        },
        get: async (data: HandlerData) => {
            return authenticate(data,
                (token, userId) => ifErrorBelowThen({code: 404},
                readUserObject(userId, 
                (user)=>{delete user.password; return Promise.resolve({code: 200, payload: user})})));
        },
        put: async (data: HandlerData) => {
            return authenticate(data,
                (token, userId) => getUserDataFromPayload(data,
                user => ifErrorBelowThen({code: 404},
                http200(_data.update('users', userId, user)))));
        },
        delete: async (data: HandlerData) => {
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
        get: async (data: HandlerData) => {
            return getTokenFromQs(data, token =>
                    ifErrorBelowThen({code: 404},
                    readTokenObject(token, tokenObject => Promise.resolve({code: 200, payload: tokenObject}))));
        },
        put: async (data: HandlerData) => {
            return getTokenFromQs(data, token =>
                ifErrorBelowThen({code: 404},
                readTokenObject(token, oldTokenObject =>
                updateExpires(oldTokenObject, updatedTokenObject =>
                http200WithPayload(_data.update('tokens', token, updatedTokenObject), updatedTokenObject)))));
        },
        delete: async (data: HandlerData) => {
            return getTokenFromQs(data, token=>
                ifErrorBelowThen({code: 404},
                http200(_data.delete('tokens', token))));
        }
    },
    notFound: async (data: HandlerData) => Promise.resolve({code: 404})
};

const getMenu = async () : Promise<HandlerResult<Menu>> =>{
    try{
        const parsedObject = _helpers.parseJsonToObject(await _data.read('', 'menu'));
        console.log('parsed menu', parsedObject);
        if(!parsedObject || !(parsedObject instanceof Array)) return {code: 500};
        const items = parsedObject.map(item=>(parseMenuItem(item))).filter(i=>i);
        return {code: 200, payload: items};
    }
    catch(e)
    {
        console.log("exception during menu parsing", e);
        return {code: 500};
    }
};

const parseMenuItem = (item: Object): ?MenuItem => {
    const id = inputOrFalse(item.id);
    const name = inputOrFalse(item.name);
    const description = inputOrFalse(item.description);
    const category = inputOrFalse(item.category);
    const price = item.price;

    return (id && name && description && category && price)
            ? {id, name, description, category, price}
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

const getTokenFromQs = async (data: HandlerData, continueWith: (token: string)=>Promise<HandlerResult<Token>>) => {
    const qs = data.queryStringObject;
    if(!qs) return {code: 400, error: 'Missing required fields'};
    const token = inputOrFalse(qs.token, 10);
    if(!token) return {code: 400, error: 'Missing required fields'};
    return continueWith(token);
}

const getExistingUserObjectByQsIdAndPayloadPassword = async (data: HandlerData, continueWith : (user: User, userId: string) => Promise<HandlerResult<Token>>): Promise<HandlerResult<Token>> => {
    const payload = data.payload;
    if(!payload) return {code: 400, error: 'Missing required fields'};
    const qs = data.queryStringObject;
    if(!qs) return {code: 400, error: 'Missing required fields'};
    const password = inputOrFalse(payload.password);
    const userId = inputOrFalse(qs.userId, 10);
    if (!password || !userId) return {code: 400, error: 'Missing required fields'};
    const user = _helpers.parseJsonToObject(await _data.read('users', userId));
    const inputPasswordHash = _helpers.hash(password);
    if(!user || user.password !== inputPasswordHash) return {code: 404};
    return continueWith(user, userId);
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

const createNewId = (length: number, continueWith: (string => Promise<HandlerResult<User>>)): Promise<HandlerResult<User>> => {
    const newId = _helpers.createRandomString(length);
    if(!newId) return Promise.resolve({code: 500, error: 'couldn\'t generate an id'});
    return continueWith(newId);
}

const getUserDataFromPayload = async (data: HandlerData, continueWith : User => Promise<HandlerResult<User>>): Promise<HandlerResult<User>> =>
{
    const payload = data.payload;
    if(!payload) return {code: 400, error: 'Missing required fields'};
    const user = getUserIfDataValid(payload);
    if (!user) return {code: 400, error: 'Missing required fields'};
    console.log('got user data from payload', user);
    return continueWith(user);
}

const authenticate = async (data: HandlerData, continueWith : (token: string, userId: string) => Promise<HandlerResult<User>>): Promise<HandlerResult<User>> =>
{
    const qs = data.queryStringObject;
    if(!qs) return {code: 400, error: 'Missing required fields'};
    const userId = inputOrFalse(qs.userId, 10);
    if(!userId) return {code: 400, error: 'Missing required fields'};
    const token = inputOrFalse(data.headers.token, 20, 20);
    if(!token || !(await isTokenValid(token, userId))) return {code: 403, error: 'No token or token did not match'};
    console.log('authenticated successfully');
    return continueWith(token, userId);
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

const isTokenValid = async (token: string, userId: string) : Promise<boolean> =>{
            try{
                const tokenObject = _helpers.parseJsonToObject(await _data.read('tokens', token));
                if(tokenObject)
                {
                    return tokenObject.expires >= Date.now() && tokenObject.userId === userId;
                }
                else return false;
            }
            catch(e){return false;}
        };

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