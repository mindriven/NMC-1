//      
const _data = require('./data');
const _helpers = require('./helpers');


                           
                        
                              
                   
                    
                    
  

                                
                 
                   
               
  

                     
                       
                      
                      
                   
                          
   

                     
                    
                  
                 
 

const ensure =    (input    )    =>{
    if(!input) throw new Error('expected value not present');
    return input;
};

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
        post: async (data             )                               => {
            const payload = data.payload;
            if(!payload) return {code: 400, error: 'Missing required fields'};
            const user = getUserIfDataValid(payload);
            if (user) {
                try {
                    await _data.read('users', user.phone);
                    return {code: 400, error: 'User already exists'};
                }
                catch (e) {
                    await _data.create('users', user.phone, user);
                    return {code: 200};
                };
            }
            else {
                return {code: 400, error: 'Missing required fields'};
            }
        },
        get: async (data             ) => {
            const qs = data.queryStringObject;
            if(!qs) return {code: 400, error: 'Missing required fields'};
            const phone = inputOrFalse(qs.phone, 10);
            if(!phone) return {code: 400, error: 'Missing required fields'};
            const token = inputOrFalse(data.headers.token, 20, 20);
            if(!token || !verifyToken(token, phone))
            {
                return {code: 403, error: 'No token or token did not match'};
            }
            try{
                const user = _helpers.parseJsonToObject(await _data.read('users', phone));
                if(user)
                {
                    delete user.password;
                    return {code: 200, payload: user}
                }
                else return {code: 404};
            }
            catch(e)
            {
                return {code: 404};
            }
        },
        put: async (data             ) => {
            const payload = data.payload;
            if(!payload) return {code: 400, error: 'Missing required fields'};
            const user = getUserIfDataValid(payload);
            if (user) {
                const token = inputOrFalse(data.headers.token, 20, 20);
                if(!token || !verifyToken(token, user.phone))
                {
                    return {code: 403, error: 'No token or token did not match'};
                }

                try {
                    await _data.update('users', user.phone, user);
                    return {code: 200};
                }
                catch (e) {
                    return {code: 404};
                };
            }
            else {
                return {code: 400, error: 'Missing required fields'};
            }
        },
        delete: async (data             ) => {
            const qs = data.queryStringObject;
            if(!qs) return {code: 400, error: 'Missing required fields'};
            const phone = inputOrFalse(qs.phone, 10);
            if(!phone) return {code: 400, error: 'Missing required fields'};
            const token = inputOrFalse(data.headers.token, 20, 20);
            if(!token || !verifyToken(token, phone))
            {
                return {code: 403, error: 'No token or token did not match'};
            }

            try{
                await _data.delete('users', phone);
                return {code: 200};
            }
            catch(e)
            {
                return {code: 404};
            }
        },
    },
    tokens: async (data             )                               => {
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
            if (password && phone) {
                const user = _helpers.parseJsonToObject(await _data.read('users', phone));
                const inputPasswordHash = _helpers.hash(password);
                const token = _helpers.createRandomString(20);
                console.log('will check');
                if(user && user.password === inputPasswordHash && token)
                {
                    const expires = Date.now() + 1000 *60 *60;
                    const tokenObject = {
                        expires,
                        token,
                        phone
                    }
                    try{
                        await _data.create('tokens', token, tokenObject);
                        return {code: 200, payload: tokenObject};
                    }
                    catch(e){
                        return {code: 500, error: 'couldn\'t persist token'};
                    }
                }
                else return {code: 404};
            }
            else {
                return {code: 400, error: 'Missing required fields'};
            }
        },
        get: async (data             ) => {
            const qs = data.queryStringObject;
            if(!qs) return {code: 400, error: 'Missing required fields'};
            const token = inputOrFalse(qs.token, 20);
            if(!token) return {code: 400, error: 'Missing required fields'};
            try{
                const tokenObject = _helpers.parseJsonToObject(await _data.read('tokens', token));
                if(tokenObject)
                {
                    return {code: 200, payload: tokenObject}
                }
                else return {code: 404};
            }
            catch(e)
            {
                return {code: 404};
            }
        },
        put: async (data             ) => {
            const qs = data.queryStringObject;
            if(!qs) return {code: 400, error: 'Missing required fields'};
            const token = inputOrFalse(qs.token, 20);
            if (token) {
                try {
                    const tokenObject         = _helpers.parseJsonToObject(await _data.read('tokens', token));
                    if(!tokenObject || tokenObject.expires>Date.now())
                    {
                        return {code: 400, error:'token expired'}
                    }
                    const updatedTokenObject = {...tokenObject, expires: (Date.now()+1000*60*60) };
                    await _data.update('tokens', token, updatedTokenObject);
                    return {code: 200, payload: updatedTokenObject};
                }
                catch (e) {
                    console.log(e);
                    return {code: 404};
                };
            }
            else {
                return {code: 400, error: 'Missing required fields'};
            }
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
            catch(e)
            {
                return {code: 404};
            }
        }
    },
    notFound: async (data             ) => Promise.resolve({code: 404})
};

const verifyToken = async (token        , phone        )                    =>{
            try{
                const tokenObject = _helpers.parseJsonToObject(await _data.read('tokens', token));
                return tokenObject && tokenObject.expires<=Date.now() && token.phone === phone;
            }
            catch(e){return {code: 500};}
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