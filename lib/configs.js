const environments = {
    staging:{
        httpPort: 3000,
        httpsPort: 3001,
        envName: 'staging',
        hashingSecret: 'abc567',
        taxRate: 0.23,
        logLevel: 7,
        logTarget: 'both',
        stripeApiKey: process.env.STRIPE_API_KEY || 'sk_test_4eC39HqLyjWDarjtT1zdp7dc',
        mailgunApiKey: process.env.MAILGUN_API_KEY,
        mailgunApiUser: 'api',
        mailDomain: 'sandbox261811fbf9134a96a4ce16baa651e497.mailgun.org',
        mailFrom: 'test <test@gmail.com>',
        invoiceSenderInterval: 1000 * 10,
        logsArchiverInterval: 1000 * 60 * 10,
        tokensCleanupInterval: 1000 * 10
    },
    production:{
        httpPort: 5000,
        httpsPort: 5001,
        envName: 'production',
        hashingSecret: 'replaceMe',
        taxRate: 0.23,
        logLevel: 5,
        logTarget: 'file',
        stripeApiKey: process.env.STRIPE_API_KEY,
        mailgunApiUser: 'api',
        mailgunApiKey: process.env.MAILGUN_API_KEY,
        mailDomain: process.env.MAIL_SOURCE_DOMAIN,
        mailFrom: 'bestPizza <bestPizza@mailgun.net>',
        invoiceSenderInterval: 1000 * 60 * 15,
        logsArchiverInterval: 1000 * 60 * 60 * 24,
        tokensCleanupInterval: 1000 * 10 * 10
    }
};

module.exports = environments[(process.env.NODE_ENV || '').toLowerCase()] || environments.staging;
