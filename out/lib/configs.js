const environments = {
    staging:{
        httpPort: 3000,
        httpsPort: 3001,
        envName: 'staging',
        hashingSecret: 'abc567',
        logLevel: 7,
        logTarget: 'both',
        stripeApiKey: process.env.STRIPE_API_KEY || 'sk_test_4eC39HqLyjWDarjtT1zdp7dc',
        mailgunApiKey: process.env.MAILGUN_API_KEY,
        mailgunApiUser: 'api',
        mailDomain: 'sandbox261811fbf9134a96a4ce16baa651e497.mailgun.org',
        mailFrom: 'kamil <3dcreator.pl@gmail.com>'
    },
    production:{
        httpPort: 5000,
        httpsPort: 5001,
        envName: 'production',
        hashingSecret: 'replaceMe',
        logLevel: 5,
        logTarget: 'file',
        stripeApiKey: process.env.STRIPE_API_KEY,
        mailgunApiUser: 'api',
        mailgunApiKey: process.env.MAILGUN_API_KEY,
        mailDomain: process.env.MAIL_SOURCE_DOMAIN,
        mailFrom: 'bestPizza <bestPizza@mailgun.net>'
    }
};

module.exports = environments[(process.env.NODE_ENV || '').toLowerCase()] || environments.staging;
