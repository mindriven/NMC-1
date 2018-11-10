//      
const _data = require('./data');
const _helpers = require('./helpers');

const handlers = {
    ping: (_, callback) => callback(200),
    users: (data, callback) => {
        const acceptableVerbs = ['post', 'get', 'put', 'delete'];
        if (acceptableVerbs.includes(data.method)) {
            handlers._users[data.method](data, callback);
        } else {
            callback(405)
        };
    },
    _users: {
        post: async (data, callback) => {
            console.log('got payload', data.payload);
            const firstName = inputOrFalse(data.payload.firstName);
            const lastName = inputOrFalse(data.payload.lastName);
            const password = inputOrFalse(data.payload.password);
            const phone = inputOrFalse(data.payload.phone, 10);
            const tosAgreement = data.payload.tosAgreement === true;
            console.log(firstName,lastName,password,phone,tosAgreement);
            if (firstName && lastName && password && phone && tosAgreement) {
                try{
                    await data.read('users', phone);
                    callback(400, {'Error': 'User already exists'});
                }
                catch(e){
                    const user = {
                        firstName,
                        lastName,
                        password: _helpers.hash(password),
                        phone
                    }

                    await _data.create('users', phone, user);
                    callback(200);
                };

            }
            else {
                console.log('missing req field');
                callback(400, {Error: 'missing required fields'});
            }

        },
        get: (data, callback) => {

        },
        put: (data, callback) => {

        },
        delete: (data, callback) => {

        },
    },
    notFound: (data, callback) => {callback(404);}
};

const inputOrFalse = (input        , minLen         = 1, maxLen         = 255) =>
    (typeof (input) === 'string' && input.trim().length >= minLen && input.trim().length <= maxLen )
    ? input.trim()
    : false;

module.exports = handlers;