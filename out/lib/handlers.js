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
    notFound: async (data             ) => Promise.resolve({code: 404})
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