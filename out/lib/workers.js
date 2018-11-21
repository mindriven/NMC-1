//      
const _logger = require('./logger');
const _data = require('./data');
const _helpers = require('./helpers');

                                             

const workers = {};
workers.sendInvoices = async function(){
    const allOrdersIds =(await _data.listFiles('orders')).map(name=>name.replace('.json', ''));
    const allOrders                            = (await Promise.all(allOrdersIds.map(async id => ({order: await _data.read('orders', id), id}))))
                                                .map(order=>({..._helpers.parseJsonToObject(order.order), id: order.id}));

    const orderWithNoInvoiceSentYet = allOrders.filter(o=>o.status==='paid');
    _logger.info('found '+orderWithNoInvoiceSentYet.length+' orders and will be sending invoices for them');
    await Promise.all(orderWithNoInvoiceSentYet.map(async order=> {
        _logger.trace('processing invoice generation for order '+order.id);

        // TODO construct mail and sent it
        
        _logger.trace('processing invoice sending for order '+order.id);
        await _data.update('orders', order.id, {...order, status:'invoiceMailed'});
    }));
};

workers.start = async function(){
    await workers.sendInvoices();
    setInterval(async ()=>{
       await workers.sendInvoices();
    }, 1000*10)
}

module.exports = {start: workers.start};