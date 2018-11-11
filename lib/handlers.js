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
    +firstName: string,
    +lastName: string,
    +password: string,
    +phone: string,
    +tosAgreement: boolean
|};

export type Token = {
    expires: number,
    token: string,
    phone: string
}

const handlers = {
    ping: async () => Promise.resolve({code: 200}),
    users: async (data: HandlerData): Promise<HandlerResult<User>> => {
        const acceptableVerbs = ['post', 'get', 'put', 'delete'];
        return acceptableVerbs.includes(data.method)
            ? handlers._users[data.method](data)
            : Promise.resolve({code: 405});
    },
    _users: {
        post: async (data: HandlerData) => {
            return getUserFromPayload(data,
                async user => ifErrorBelowThen({code: 400, error: 'User already exists'},
                http200(_data.create('users', user.phone, user))));
        },
        get: async (data: HandlerData) => {
            return authenticate(data,
                async (token, phone)=> ifErrorBelowThen({code: 404},
                readUserObject(phone,
                async (user)=>{delete user.password; return {code: 200, payload: user}})));
        },
        put: async (data: HandlerData) => {
            return authenticate(data,
                async (token, phone) => getUserFromPayload(data,
                async user => ifErrorBelowThen({code: 404},
                http200(_data.update('users', phone, user)))));
        },
        delete: async (data: HandlerData) => {
            return authenticate(data,
                async (token, phone) => ifErrorBelowThen({code: 404},
                http200(_data.delete('users', phone))));
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
            const payload = data.payload;
            if(!payload) return {code: 400, error: 'Missing required fields'};
            const password = inputOrFalse(payload.password);
            const phone = inputOrFalse(payload.phone, 10);
            if (!password || !phone) return {code: 400, error: 'Missing required fields'};
            const user = _helpers.parseJsonToObject(await _data.read('users', phone));
            const inputPasswordHash = _helpers.hash(password);
            const token = _helpers.createRandomString(20);
            if(!user || !token || user.password !== inputPasswordHash) return {code: 404};

            const expires = Date.now() + 1000 * 60 * 60;
            const tokenObject = {
                expires,
                token,
                phone
            }
            try{
                await _data.create('tokens', token, tokenObject);
                return {code: 200, payload: tokenObject};
            }
            catch(e){ return {code: 500, error: 'couldn\'t persist token'}; }
            
        },
        get: async (data: HandlerData) => {
            // return getTokenFromQs(data,
            //     async token => ifErrorBelowThen({code: 404},
            //     readTokenObject(token, 
            //     tokenObject=>{code: 200, payload: tokenObject})));

            const qs = data.queryStringObject;
            if(!qs) return {code: 400, error: 'Missing required fields'};
            const token = inputOrFalse(qs.token, 20, 20);
            if(!token) return {code: 400, error: 'Missing required fields'};
            try{
                const tokenObject = _helpers.parseJsonToObject(await _data.read('tokens', token));
                return tokenObject ? {code: 200, payload: tokenObject} : {code: 404};
            }
            catch(e) { return {code: 404}; }
        },
        put: async (data: HandlerData) => {
            const qs = data.queryStringObject;
            if(!qs) return {code: 400, error: 'Missing required fields'};
            const token = inputOrFalse(qs.token, 20, 20);
            if (!token) return {code: 400, error: 'Missing required fields'};

            try {
                const tokenObject: ?Token = _helpers.parseJsonToObject(await _data.read('tokens', token));
                if(!tokenObject || tokenObject.expires>Date.now()) return {code: 400, error:'token expired'}

                const updatedTokenObject = {...tokenObject, expires: (Date.now()+1000*60*60) };
                await _data.update('tokens', token, updatedTokenObject);
                return {code: 200, payload: updatedTokenObject};
            }
            catch (e) { return {code: 404}; }
            
        },
        delete: async (data: HandlerData) => {
            const qs = data.queryStringObject;
            if(!qs) return {code: 400, error: 'Missing required fields'};
            const token = inputOrFalse(qs.token, 10);
            if(!token) return {code: 400, error: 'Missing required fields'};
            try{
                await _data.delete('tokens', token);
                return {code: 200};
            }
            catch(e) { return {code: 404}; }
        }
    },
    notFound: async (data: HandlerData) => Promise.resolve({code: 404})
};

const getUserFromPayload = async (data: HandlerData, continueWith : User => Promise<HandlerResult<User>>): Promise<HandlerResult<User>> =>
{
    const payload = data.payload;
    if(!payload) return {code: 400, error: 'Missing required fields'};
    const user = getUserIfDataValid(payload);
    if (!user) return {code: 400, error: 'Missing required fields'};
    return continueWith(user);
}


const authenticate = async (data: HandlerData, continueWith : (token: string, phone: string) => Promise<HandlerResult<User>>): Promise<HandlerResult<User>> =>
{
    const qs = data.queryStringObject;
    if(!qs) return {code: 400, error: 'Missing required fields'};
    const phone = inputOrFalse(qs.phone, 10);
    if(!phone) return {code: 400, error: 'Missing required fields'};
    const token = inputOrFalse(data.headers.token, 20, 20);
    if(!token || !(await isTokenValid(token, phone))) return {code: 403, error: 'No token or token did not match'};
    return continueWith(token, phone);
}

const readUserObject = async (phone : string, continueWith: (user: User) => Promise<HandlerResult<User>>): Promise<HandlerResult<User>> =>
{
    const user = _helpers.parseJsonToObject(await _data.read('users', phone));
    if(!user) return {code: 404};
    return continueWith(user);
}

const ifErrorBelowThen = async (onError: HandlerResult<User>, continueWith: Promise<HandlerResult<User>>): Promise<HandlerResult<User>> =>
{
    return continueWith.catch(e=>onError);
}

async function http200<T, V> (p: Promise<T>): Promise<HandlerResult<V>>
{
    await p;
    return { code : 200 };
}

const isTokenValid = async (token: string, phone: string) : Promise<boolean> =>{
            try{
                const tokenObject = _helpers.parseJsonToObject(await _data.read('tokens', token));
                if(tokenObject)
                {
                    return tokenObject.expires >= Date.now() && tokenObject.phone === phone;
                }
                else return false;
            }
            catch(e){return false;}
        };

const getUserIfDataValid = (payload:Object): ?User => {
                const firstName = inputOrFalse(payload.firstName);
                const lastName = inputOrFalse(payload.lastName);
                const password = inputOrFalse(payload.password);
                const phone = inputOrFalse(payload.phone, 10);
                const tosAgreement = payload.tosAgreement === true;
                const hashedPassword = password ? _helpers.hash(password): false;

                if(firstName && lastName && hashedPassword && phone && tosAgreement)
                {
                    return {
                        firstName,
                        lastName,
                        password: hashedPassword,
                        phone,
                        tosAgreement
                    }
                }
                else return undefined;
            };

const inputOrFalse = (input: string, minLen: number = 1, maxLen: number = 255) =>
    (typeof (input) === 'string' && input.trim().length >= minLen && input.trim().length <= maxLen)
        ? input.trim()
        : false;

module.exports = handlers;