//      
// Dependencies
const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./configs');
const fs = require('fs');
const _data = require('./lib/data');

const handlers = {
    ping: (_, callback) => callback(200),
    hello: (_, callback) => callback(200),
    notFound: (data, callback) => {callback(404);}
};
const router = {
    '/ping': handlers.ping,
    '/hello': handlers.hello
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

function serverLogic(req, res) {
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
    req.on('end', () => {
        buffer += decoder.end();
        console.log('request came in for path:', trimmedPath);
        const handler = router[trimmedPath] || handlers.notFound;
        const handlerData = {
            trimmedPath,
            queryStringObject,
            method,
            headers,
            payload: buffer
        };
        const callback = (statusCode, payload) => {
            res.setHeader('Content-type', 'application/json');
            res.writeHead(statusCode || 200);
            const responseContent = statusCode === 200
                ? JSON.stringify({greeting: 'Hello ' + (queryStringObject.name || 'stranger') + '!'})
                : '';
            res.end(responseContent);
            console.log('returning: ', statusCode, responseContent);
        };
        handler(handlerData, callback);
    });
}

