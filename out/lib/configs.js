const environments = {
    staging:{
        httpPort: 3000,
        httpsPort: 3001,
        envName: 'staging',
        hashingSecret: 'abc567'
    },
    production:{
        httpPort: 5000,
        httpsPort: 5001,
        envName: 'production',
        hashingSecret: 'replaceMe'
    }
};

module.exports = environments[(process.env.NODE_ENV || '').toLowerCase()] || environments.staging;
