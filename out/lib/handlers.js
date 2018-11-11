//      
const _data = require('./data');
const _helpers = require('./helpers');


                           
                        
                              
                   
                    
                    
  

                                
                 
                   
               
  

                     
                       
                      
                      
                   
                          
   

                     
                    
                  
                 
 

const getUserFromPayload = async (data             , continueWith                                       )                               =>
{
    const payload = data.payload;
    if(!payload) return {code: 400, error: 'Missing required fields'};
    const user = getUserIfDataValid(payload);
    if (!user) return {code: 400, error: 'Missing required fields'};
    return continueWith(user);
}


const authenticate = async (data             , continueWith                                                                 )                               =>
{
    const qs = data.queryStringObject;
    if(!qs) return {code: 400, error: 'Missing required fields'};
    const phone = inputOrFalse(qs.phone, 10);
    if(!phone) return {code: 400, error: 'Missing required fields'};
    const token = inputOrFalse(data.headers.token, 20, 20);
    if(!token || !(await isTokenValid(token, phone))) return {code: 403, error: 'No token or token did not match'};
    console.log('authenticated');
    return continueWith(token, phone);
}

const readUserObject = async (phone         , continueWith                                              )                               =>
{
    const user = _helpers.parseJsonToObject(await _data.read('users', phone));
    if(!user) return {code: 404};
    return continueWith(user);
}

const ifErrorBelowThen = async (onError                     , continueWith                              )                               =>
{
    return continueWith.catch(e=>onError);
}

async function http200       (p            )                           
{
    await p;
    return { code : 200 };
}

const handlers = {
    ping: async () => Promise.resolve({code: 200}),
    users: async (data             )                               => {
        const acceptableVerbs = ['post', 'get', 'put', 'delete'];
        if (acceptableVerbs.includes(data.method)) {
            return handlers._users[data.method](data);
        } else {
            return Promise.resolve({code: 405});
        };
    },
    _users: {
        post: async (data             ) => {
            return getUserFromPayload(data,
                async user => ifErrorBelowThen({code: 400, error: 'User already exists'},
                http200(_data.create('users', user.phone, user))));
        },
        get: async (data             ) => {
            return authenticate(data,
                async (token, phone)=> ifErrorBelowThen({code: 404},
                readUserObject(phone,
                async (user)=>{delete user.password; return {code: 200, payload: user}})));
        },
        put: async (data             ) => {
            return authenticate(data,
                async (token, phone) => getUserFromPayload(data,
                async user => ifErrorBelowThen({code: 404},
                http200(_data.update('users', phone, user)))));
        },
        delete: async (data             ) => {
            return authenticate(data,
                async (token, phone) => ifErrorBelowThen({code: 404},
                http200(_data.delete('users', phone))));

            // const qs = data.queryStringObject;
            // if(!qs) return {code: 400, error: 'Missing required fields'};
            // const phone = inputOrFalse(qs.phone, 10);
            // if(!phone) return {code: 400, error: 'Missing required fields'};
            // const token = inputOrFalse(data.headers.token, 20, 20);
            // if(!token || !verifyToken(token, phone)) return {code: 403, error: 'No token or token did not match'};

            // try{
            //     await _data.delete('users', phone);
            //     return {code: 200};
            // }
            // catch(e){ return {code: 404}; }
        },
    },
    tokens: async (data             )                                => {
        const acceptableVerbs = ['post', 'get', 'put', 'delete'];
        if (acceptableVerbs.includes(data.method)) {
            return handlers._tokens[data.method](data);
        } else {
            return Promise.resolve({code: 405});
        };
    },
    _tokens: {
        post: async (data             )                                => {
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
        get: async (data             ) => {
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
        put: async (data             ) => {
            const qs = data.queryStringObject;
            if(!qs) return {code: 400, error: 'Missing required fields'};
            const token = inputOrFalse(qs.token, 20, 20);
            if (!token) return {code: 400, error: 'Missing required fields'};

            try {
                const tokenObject         = _helpers.parseJsonToObject(await _data.read('tokens', token));
                if(!tokenObject || tokenObject.expires>Date.now()) return {code: 400, error:'token expired'}

                const updatedTokenObject = {...tokenObject, expires: (Date.now()+1000*60*60) };
                await _data.update('tokens', token, updatedTokenObject);
                return {code: 200, payload: updatedTokenObject};
            }
            catch (e) { return {code: 404}; }
            
        },
        delete: async (data             ) => {
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
    notFound: async (data             ) => Promise.resolve({code: 404})
};

const isTokenValid = async (token        , phone        )                    =>{
            try{
                const tokenObject = _helpers.parseJsonToObject(await _data.read('tokens', token));
                if(tokenObject)
                {
                    const result = tokenObject.expires >= Date.now() && tokenObject.phone === phone;
                    console.log(tokenObject, phone, result, tokenObject.expires, Date.now(), tokenObject.phone === phone);
                    return result;
                }
                else return false;
            }
            catch(e){return false;}
        };

const getUserIfDataValid = (payload       )        => {
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

const inputOrFalse = (input        , minLen         = 1, maxLen         = 255) =>
    (typeof (input) === 'string' && input.trim().length >= minLen && input.trim().length <= maxLen)
        ? input.trim()
        : false;

module.exports = handlers;