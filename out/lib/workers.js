//      
const _logger = require('./logger');
const _data = require('./data');
const _helpers = require('./helpers');
const _config = require('./configs');
const https = require('https');

                                                   

const workers = {};
workers.sendInvoices = async function () {
    const allOrdersIds = (await _data.listFiles('orders')).map(name => name.replace('.json', ''));
    const allOrders          = (await Promise.all(allOrdersIds.map(async id => ({order: await _data.read('orders', id), id}))))
        .map(order => ({..._helpers.parseJsonToObject(order.order), id: order.id}));

    const orderWithNoInvoiceSentYet = allOrders.filter(o => o.status === 'paid');
    _logger.info('found ' + orderWithNoInvoiceSentYet.length + ' orders and will be sending invoices for them');
    
    await Promise.all(orderWithNoInvoiceSentYet.map(async order => {
        try{
            _logger.trace('processing invoice generation for order ' + order.id);
            
            const user = _helpers.parseJsonToObject(await _data.read('users', order.userId));
            if (!user) {
                _logger.error(`user with id ${order.userId} defined as creator of order ${order.id} does no longer exist`);
                return undefined;
            }
            
            const mailData = {
                from: _config.mailFrom,
                to: user.email,
                subject: 'Your invoice for order ' + order.id,
                html: createMailBody(order, user)
            };
            const encodedMailData = _helpers.encodePostData(mailData);
            
            const mailRequestOptions = getMailgunPostOptions(encodedMailData);
            const mailgunResponse = await _helpers.getResponseBodyAsString(mailRequestOptions, encodedMailData);

            _logger.trace('processing invoice sending for order ' + order.id);
            await _data.update('orders', order.id, {...order, status: 'invoiceMailed'});
        }
        catch(e)
        {
            _logger.error('error during sending an invoice for order ' + order.id, e);
            await _data.update('orders', order.id, {...order, status: 'errorMailingInvoice'});
        }
    }));
};

function createMailBody(order       , user      )         {
    const positions = order.positions.map(p => `<tr>
                                                    <td>${p.itemId}-${p.itemName}</td>
                                                    <td>${p.qty}</td>
                                                    <td>${p.grossPrice}</td>
                                                </tr>`);

    return `<div><p>Hi ${user.firstName}, this is</p>
<h1>Your invoice for order #${order.id}</h1>
<table>
    <tr>
        <th>Product</th>
        <th>Quantity</th>
        <th>Price</th>
    </tr>
    ${positions.join('\r\n')}
</table>
<div>
    <p>Order sum: ${order.totals.grossPrice}</p>
    <p>Including tax: ${order.totals.tax}</p>
    <p>Order was already paid via credit card, payment id: ${order.chargeId || ''}</p>
    <p>Thanks for ordering at our pizzeria!</p>
    <small>Please do not respond to this message. If you have any questions please contact us directly under 123456789.</small>
</div>
</div>
`;
}

function getMailgunPostOptions(requestData        )         {
    const options = {
        auth: _config.mailgunApiUser + ':' + _config.mailgunApiKey,
        method: 'POST',
        host: 'api.mailgun.net',
        path: `/v3/${_config.mailDomain}/messages`,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(requestData),
        }
    };
    return options;
}

workers.start = async function () {
    await workers.sendInvoices();
    // setInterval(async ()=>{
    //    await workers.sendInvoices();
    // }, 1000*10)
}

module.exports = {start: workers.start};