// @flow

const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('../configs');
const handlers = require('./handlers');
const helpers = require('../helpers');
const fs = require('fs');
const _logger = require('../logger')('server');

import type {HandlerData} from './handlers';

const router = {
    '/ping': handlers.ping,
    '/api/users': handlers.users,
    '/api/tokens': handlers.tokens,
    '/api/menu': handlers.menu,
    '/api/cart': handlers.cart,
    '/api/checkout': handlers.checkout,
    '/api/orders': handlers.orders,
    '/': handlers.public,
};

function start() {
    const httpsServerOptions = {
        key: fs.readFileSync('./https/key.pem'),
        cert: fs.readFileSync('./https/cert.pem')
    };
    const httpsServer = https.createServer(httpsServerOptions, (req, res) => {serverLogic(req, res);});
    const httpServer = http.createServer((req, res) => {serverLogic(req, res);});

    httpServer.listen(config.httpPort, () => {
        _logger.info('the http server is listening on port ' + config.httpPort + ' now, configuration is ' + config.envName);
    });

    httpsServer.listen(config.httpsPort, () => {
        _logger.info('the https server is listening on port ' + config.httpsPort + ' now, configuration is ' + config.envName);
    });
}
const knownMimeTypes = {
    'css':'text/css',
    'html':'text/html',
    'jpg':'image/jpeg',
    'png':'image/png',
    'ico':'favicon',
    'js':'application/javascript'
}

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
        _logger.info('request came in for path: ' + trimmedPath);
        _logger.debug('requests payload: ' + buffer);
        const fileExtension = trimmedPath.split('.').reverse()[0] || 'html';
        const staticAssetRequest = path === '/' || trimmedPath.startsWith('/public/');
        const handler = staticAssetRequest
                    ? handlers.public
                    : router[trimmedPath] || handlers.notFound;
        const handlerData: HandlerData = {
            trimmedPath,
            queryStringObject,
            method,
            headers,
            payload: helpers.parseJsonToObject(buffer)
        };

        try {
            console.log(handlerData);
            const handlerResult = await handler(handlerData);
            console.log(fileExtension);
            res.setHeader('Content-type', knownMimeTypes[fileExtension] || 'application/json');
            res.writeHead(handlerResult.code);
            const responseContent = (handlerResult.code === 200 || handlerResult.code === 201) && handlerResult.payload
                ? staticAssetRequest ? handlerResult.payload : JSON.stringify(handlerResult.payload)
                : JSON.stringify({Error: handlerResult.error});
            res.end(responseContent)

            _logger.info('returning: ' + handlerResult.code);
            // _logger.debug('response content', responseContent);
        }
        catch (e) {
            _logger.fatal('unhandled exception during request processing', e);
            res.writeHead(500);
            res.end('');
        }
    });
}


module.exports = {start};