const environments = {
    staging:{
        httpPort: 3000,
        httpsPort: 3001,
        envName: 'staging'
    },
    production:{
        httpPort: 5000,
        httpsPort: 5001,
        envName: 'production'
    }
};

module.exports = environments[(process.env.NODE_ENV || '').toLowerCase()] || environments.staging;
