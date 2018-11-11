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
        if (acceptableVerbs.includes(data.method)) {
            return handlers._users[data.method](data);
        } else {
            return Promise.resolve({code: 405});
        };
    },
    _users: {
        post: async (data: HandlerData): Promise<HandlerResult<User>> => {
            const payload = data.payload;
            if(!payload) return {code: 400, error: 'Missing required fields'};
            const user = getUserIfDataValid(payload);
            if (!user) return {code: 400, error: 'Missing required fields'};

            try {
                await _data.read('users', user.phone);
                return {code: 400, error: 'User already exists'};
            }
            catch (e) {
                await _data.create('users', user.phone, user);
                return {code: 200};
            };
        },
        get: async (data: HandlerData) => {
            const qs = data.queryStringObject;
            if(!qs) return {code: 400, error: 'Missing required fields'};
            const phone = inputOrFalse(qs.phone, 10);
            if(!phone) return {code: 400, error: 'Missing required fields'};
            const token = inputOrFalse(data.headers.token, 20, 20);
            if(!token || !verifyToken(token, phone)) return {code: 403, error: 'No token or token did not match'};
        
            try{
                const user = _helpers.parseJsonToObject(await _data.read('users', phone));
                if(!user) return {code: 404};
                delete user.password;
                return {code: 200, payload: user}
            }
            catch(e) { return {code: 404}; }
        },
        put: async (data: HandlerData) => {
            const payload = data.payload;
            if(!payload) return {code: 400, error: 'Missing required fields'};
            const user = getUserIfDataValid(payload);
            if (!user) return {code: 400, error: 'Missing required fields'};
            const token = inputOrFalse(data.headers.token, 20, 20);
            if(!token || !verifyToken(token, user.phone)) return {code: 403, error: 'No token or token did not match'};
    
            try {
                await _data.update('users', user.phone, user);
                return {code: 200};
            }
            catch (e) { return {code: 404};}
        },
        delete: async (data: HandlerData) => {
            const qs = data.queryStringObject;
            if(!qs) return {code: 400, error: 'Missing required fields'};
            const phone = inputOrFalse(qs.phone, 10);
            if(!phone) return {code: 400, error: 'Missing required fields'};
            const token = inputOrFalse(data.headers.token, 20, 20);
            if(!token || !verifyToken(token, phone)) return {code: 403, error: 'No token or token did not match'};

            try{
                await _data.delete('users', phone);
                return {code: 200};
            }
            catch(e){ return {code: 404}; }
        },
    },
    tokens: async (data: HandlerData): Promise<HandlerResult<User>> => {
        const acceptableVerbs = ['post', 'get', 'put', 'delete'];
        if (acceptableVerbs.includes(data.method)) {
            return handlers._tokens[data.method](data);
        } else {
            return Promise.resolve({code: 405});
        };
    },
    _tokens: {
        post: async (data: HandlerData): Promise<HandlerResult<Token>> => {
            const payload = data.payload;
            console.log(payload);
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
            const qs = data.queryStringObject;
            if(!qs) return {code: 400, error: 'Missing required fields'};
            const token = inputOrFalse(qs.token, 20);
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

const verifyToken = async (token: string, phone: string) : Promise<boolean> =>{
            try{
                const tokenObject = _helpers.parseJsonToObject(await _data.read('tokens', token));
                if(tokenObject)
                {
                    return tokenObject.expires <= Date.now() && tokenObject.phone === phone;
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