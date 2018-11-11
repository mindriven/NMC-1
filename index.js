// @flow
// Dependencies
const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./configs');
const handlers = require('./lib/handlers');
const helpers = require('./lib/helpers');
const fs = require('fs');
const _data = require('./lib/data');

import type {User, HandlerData} from './lib/handlers';

const router = {
    '/ping': handlers.ping,
    '/users': handlers.users,
    '/tokens': handlers.tokens
};

const httpServer = http.createServer((req, res) => {serverLogic(req, res);});
const httpsServerOptions = {
    key: fs.readFileSync('./https/key.pem'),
    cert: fs.readFileSync('./https/cert.pem')
};

const httpsServer = https.createServer(httpsServerOptions, (req, res) => {serverLogic(req, res);});


httpServer.listen(config.httpPort, () => {
    console.log('the server is listening on port ' + config.httpPort + ' now, configuration is', config.envName);
});

httpsServer.listen(config.httpsPort, () => {
    console.log('the server is listening on port ' + config.httpsPort + ' now, configuration is', config.envName);
});

async function serverLogic(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname || '';
    const trimmedPath = path.replace(/\/+$/g, '');
    const method = req.method.toLowerCase();
    const queryStringObject = parsedUrl.query || {};
    const headers = req.headers;
    const decoder = new StringDecoder('utf8');
    let buffer = '';
    req.on('data', (data) => {
        buffer += decoder.write(data);
    });
    req.on('end', async () => {
        buffer += decoder.end();
        console.log('request came in for path:', trimmedPath, buffer);
        const handler = router[trimmedPath] || handlers.notFound;
        const handlerData: HandlerData = {
            trimmedPath,
            queryStringObject,
            method,
            headers,
            payload: helpers.parseJsonToObject(buffer)
        };

        const handlerResult = await handler(handlerData);

        res.setHeader('Content-type', 'application/json');
        res.writeHead(handlerResult.code || 200);
        const responseContent = handlerResult.code === 200 && handlerResult.payload
                ? JSON.stringify(handlerResult.payload)
                : '';
        res.end(responseContent);
        console.log('returning: ', handlerResult.code, responseContent);
    });
}

