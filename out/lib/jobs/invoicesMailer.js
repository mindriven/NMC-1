//      

const _dal = require('../DAL');
const _config = require('../configs');
const _helpers = require('../helpers');
const _logger = require('../logger');

                                             

async function sendInvoices() {
    const allOrders          = await _dal.getAllOrders();

    const orderWithNoInvoiceSentYet = allOrders.filter(o => o.status === 'paid');
    _logger.info('found ' + orderWithNoInvoiceSentYet.length + ' orders and will be sending invoices for them');
    
    await Promise.all(orderWithNoInvoiceSentYet.map(async order => {
        try{
            _logger.trace('processing invoice generation for order ' + order.id);
            
            const user = await _dal.findUserById(order.userId);
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

            if(mailgunResponse)
            {
                _logger.info('invoice sending for order ' + order.id+ ' sent');
                await _dal.saveOrder({...order, status: 'invoiceMailed'});
            }
            else{
                _logger.error('there was a problem sending invoice for order '+order.id);
            }
        }
        catch(e)
        {
            _logger.error('error during sending an invoice for order ' + order.id, e);
            await _dal.saveOrder({...order, status: 'errorMailingInvoice'});
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

module.exports = sendInvoices;