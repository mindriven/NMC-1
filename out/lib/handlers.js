//      
const _data = require('./data');
const _helpers = require('./helpers');


                           
                        
                              
                   
                    
                    
  

                                
                 
                   
               
  

                     
                 
                   
                      
                       
                      
                          
   

                     
                    
                  
                  
 

                                                                                     
                        

const handlers = {
    ping: async () => Promise.resolve({code: 200}),
    menu: async(data             )                                 => {
        return data.method==='get'
            ? {code: 200, payload: await _data.read('', 'menu')}
            : Promise.resolve({code: 405});
    },
    users: async (data             )                               => {
        const acceptableVerbs = ['post', 'get', 'put', 'delete'];
        return acceptableVerbs.includes(data.method)
            ? handlers._users[data.method](data)
            : Promise.resolve({code: 405});
    },
    _users: {
        post: async (data             ) => {
            return getUserDataFromPayload(data, user =>
                ifErrorBelowThen({code: 400, error: 'User already exists'},
                createNewId(20, userId =>
                http200WithPayload(_data.create('users', userId, user), {...user, id: userId}))));
        },
        get: async (data             ) => {
            return authenticate(data,
                (token, userId) => ifErrorBelowThen({code: 404},
                readUserObject(userId, 
                (user)=>{delete user.password; return Promise.resolve({code: 200, payload: user})})));
        },
        put: async (data             ) => {
            return authenticate(data,
                (token, userId) => getUserDataFromPayload(data,
                user => ifErrorBelowThen({code: 404},
                http200(_data.update('users', userId, user)))));
        },
        delete: async (data             ) => {
            return authenticate(data,
                (token, userId) => ifErrorBelowThen({code: 404},
                http200(_data.delete('users', userId))));
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
                http200WithPayload(_data.create('tokens', tokenObject.token, tokenObject), tokenObject))));
        },
        get: async (data             ) => {
            return getTokenFromQs(data, token =>
                    ifErrorBelowThen({code: 404},
                    readTokenObject(token, tokenObject => Promise.resolve({code: 200, payload: tokenObject}))));
        },
        put: async (data             ) => {
            return getTokenFromQs(data, token =>
                ifErrorBelowThen({code: 404},
                readTokenObject(token, oldTokenObject =>
                updateExpires(oldTokenObject, updatedTokenObject =>
                http200WithPayload(_data.update('tokens', token, updatedTokenObject), updatedTokenObject)))));
        },
        delete: async (data             ) => {
            return getTokenFromQs(data, token=>
                ifErrorBelowThen({code: 404},
                http200(_data.delete('tokens', token))));
        }
    },
    notFound: async (data             ) => Promise.resolve({code: 404})
};

const readTokenObject = async (token        , continueWith                                                              ) => {
    const tokenObject         = _helpers.parseJsonToObject(await _data.read('tokens', token));
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

const updateExpires = async (token       , continueWith                                                              ) => {
    const updatedTokenObject = {...token, expires: newTokenExpirationDate()};
    await _data.update('tokens', token.token, updatedTokenObject);
    return continueWith(updatedTokenObject);
}

const getTokenFromQs = async (data             , continueWith                                                ) => {
    const qs = data.queryStringObject;
    if(!qs) return {code: 400, error: 'Missing required fields'};
    const token = inputOrFalse(qs.token, 10);
    if(!token) return {code: 400, error: 'Missing required fields'};
    return continueWith(token);
}

const getExistingUserObjectByQsIdAndPayloadPassword = async (data             , continueWith                                                                )                                => {
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

const createNewId = (length        , continueWith                                          )                               => {
    const newId = _helpers.createRandomString(length);
    if(!newId) return Promise.resolve({code: 500, error: 'couldn\'t generate an id'});
    return continueWith(newId);
}

const getUserDataFromPayload = async (data             , continueWith                                       )                               =>
{
    const payload = data.payload;
    if(!payload) return {code: 400, error: 'Missing required fields'};
    const user = getUserIfDataValid(payload);
    if (!user) return {code: 400, error: 'Missing required fields'};
    console.log('got user data from payload', user);
    return continueWith(user);
}

const authenticate = async (data             , continueWith                                                                  )                               =>
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

const readUserObject = async (userId         , continueWith                                              )                               =>
{
    const user = _helpers.parseJsonToObject(await _data.read('users', userId));
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

const isTokenValid = async (token        , userId        )                    =>{
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

const getUserIfDataValid = (payload       )        => {
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

module.exports = handlers;