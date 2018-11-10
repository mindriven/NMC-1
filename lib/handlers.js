// @flow
const _data = require('./data');
const _helpers = require('./helpers');


export type HandlerData = {
    trimmedPath: string,
    queryStringObject: Object,
    method: string,
    headers: Object,
    payload: Object
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
            const firstName = inputOrFalse(data.payload.firstName);
            const lastName = inputOrFalse(data.payload.lastName);
            const password = inputOrFalse(data.payload.password);
            const phone = inputOrFalse(data.payload.phone, 10);
            const tosAgreement = data.payload.tosAgreement === true;
            if (firstName && lastName && password && phone && tosAgreement) {
                try {
                    await _data.read('users', phone);
                    return {code: 400, error: 'User already exists'};
                }
                catch (e) {
                    const user = {
                        firstName,
                        lastName,
                        password: _helpers.hash(password),
                        phone
                    }
                    await _data.create('users', phone, user);
                    return {code: 200};
                };
            }
            else {
                return {code: 400, error: 'Missing required fields'};
            }

        },
        get: async (data: HandlerData) => {

        },
        put: async (data: HandlerData) => {

        },
        delete: async (data: HandlerData) => {

        },
    },
    notFound: async (data: HandlerData) => Promise.resolve({code: 404})
};

const inputOrFalse = (input: string, minLen: number = 1, maxLen: number = 255) =>
    (typeof (input) === 'string' && input.trim().length >= minLen && input.trim().length <= maxLen)
        ? input.trim()
        : false;

module.exports = handlers;