const environments = {
    staging:{
        httpPort: 3000,
        httpsPort: 3001,
        envName: 'staging',
        hashingSecret: 'abc567',
        logLevel: 7,
        logTarget: 'both'
    },
    production:{
        httpPort: 5000,
        httpsPort: 5001,
        envName: 'production',
        hashingSecret: 'replaceMe',
        logLevel: 5,
        logTarget: 'file'
    }
};

module.exports = environments[(process.env.NODE_ENV || '').toLowerCase()] || environments.staging;
