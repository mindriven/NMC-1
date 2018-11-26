// @flow

const readline = require('readline');
const util = require('util');
const debug = util.debuglog('cli');
const events = require('events');
class _events extends events {};
const e = new _events();
const os = require('os');
const v8 = require('v8');
const _dal = require('./DAL');

const cli = {};

import type {Order} from './entities';

e.on('man', (_: string) => cli.responders.help());
e.on('help', (_: string) => cli.responders.help());
e.on('exit', (userInput: string) => cli.responders.exit());
e.on('stats', (userInput: string) => cli.responders.stats());
e.on('menu', (userInput: string) => cli.responders.menu());
e.on('orders', (userInput: string) => cli.responders.orders(userInput));
e.on('users', (userInput: string) => cli.responders.users(userInput));

cli.responders = {};

const commands = {
    'exit': 'Kill the CLI (and the rest of the application)',
    'man': 'Show this help page',
    'help': 'Alias of the "man" command',
    'stats': 'Get statistics on the underlying operating system and resource utilization',
    'menu': 'show menu items',
    'orders [id]': 'Show a list of orders placed within last 24 hours if no id specified. If id specified get the details of the specific order',
    'users [email|id]': 'Show a list of all the users registered (and not undeleted) in the system within last 24 hours if no email/id specified. If email address/id is provided only users with matching email/id will be shown.',
};

cli.responders.help = () => printObjectAsLines('CLI MANUAL', commands);

const printObjectAsLines = (title: string, obj: {[string]: string | number}) => {

    cli.horizontalLine();
    cli.centered(title);
    cli.horizontalLine();
    cli.verticalSpace(2);

    Object.keys(obj).forEach(key => {
        const header = '      \x1b[33m ' + key + '      \x1b[0m';
        const line = header + ''.padStart(60 - header.length, ' ') + obj[key];
        console.log(line);
        cli.verticalSpace();
    });

    cli.verticalSpace(1);
    cli.horizontalLine();

}

cli.verticalSpace = (lines: number = 1) => new Array(lines).forEach(i => console.log(i));

cli.horizontalLine = () => {
    // $FlowFixMe
    const width = process.stdout.columns;
    console.log(''.padStart(width, '-'));
};

// Create centered text on the screen
cli.centered = function (str: string) {
    str = typeof (str) == 'string' && str.trim().length > 0 ? str.trim() : '';
    // $FlowFixMe
    const width = process.stdout.columns;
    const leftPadding = Math.floor((width - str.length) / 2);
    console.log(str.padStart(leftPadding, ' '));
};

cli.responders.exit = function () {
    process.exit(0);
};

cli.responders.stats = function () {
    const stats = {
        'Load Average': os.loadavg().join(' '),
        'CPU Count': os.cpus().length,
        'Free Memory': os.freemem(),
        'Current Malloced Memory': v8.getHeapStatistics().malloced_memory,
        'Peak Malloced Memory': v8.getHeapStatistics().peak_malloced_memory,
        'Allocated Heap Used (%)': Math.round((v8.getHeapStatistics().used_heap_size / v8.getHeapStatistics().total_heap_size) * 100),
        'Available Heap Allocated (%)': Math.round((v8.getHeapStatistics().total_heap_size / v8.getHeapStatistics().heap_size_limit) * 100),
        'Uptime': os.uptime() + ' Seconds'
    };

    printObjectAsLines('SYSTEM STATISTICS', stats);
};

cli.responders.users = async (userInput: string) => {
    const splitInput = userInput.split(' ');
    const emailAddressOrId = splitInput.length == 2 && (splitInput.reverse()[0] || '');

    const usersToPrint = emailAddressOrId
        ? (await _dal.getAllUsers()).filter(u => u.email === emailAddressOrId || u.id === emailAddressOrId)
        : (await _dal.getRecentUsers(24));

    console.log(`found ${usersToPrint.length} users fulfilling the criteria`);
    usersToPrint.forEach((user, i) => {
        console.log(i + 1 + ` | ID: ${user.id}, Name: ${user.firstName} ${user.lastName}, Created: ${user.createdAt}`);
        cli.verticalSpace();
    })

};

cli.responders.menu = async () => {
    const menu = await _dal.readMenu() || [];

    console.log(`found ${menu.length} positions`);
    menu.forEach((position, i) => {
        console.log(i + 1 + `| ID: ${position.id}, Name: ${position.name}, Description: ${position.description}, Price: ${position.price.toFixed(2)}`);
    })
    cli.verticalSpace();
};


cli.responders.orders = async (userInput: string) => {
    const splitInput = userInput.split(' ');
    const orderId = splitInput.length == 2 && (splitInput.reverse()[0] || '');

    let ordersToPrint: Order[] = [];
    if (orderId) {
        const matchingOrder = await _dal.findOrderById(orderId);
        if (matchingOrder)
            ordersToPrint.push(matchingOrder);
    }
    else
        ordersToPrint = await _dal.getRecentOrders(24);

    console.log(`found ${ordersToPrint.length} orders fulfilling the criteria`);
    ordersToPrint.forEach((order, i) => {
        console.log(i + 1 + ` | ID: ${order.id}, Status: ${order.status}, NoOfPoistions: ${order.positions.length}, Price: ${order.totals.grossPrice.toFixed(2)}, Tax: ${order.totals.tax.toFixed(2)}, UserId: ${order.userId}, Created: ${order.createdAt.toString()}, ChargeId: ${order.chargeId || ''}`);
        cli.verticalSpace();
    })
};

cli.processInput = (trimmedUserInput: string) => {
    if (typeof (trimmedUserInput) !== 'string' && trimmedUserInput.length > 0) return;

    const possibleCommands = Object.keys(commands).map(i => i.split(' ')[0]);
    const chosenCommand = possibleCommands.find(c => c === trimmedUserInput || trimmedUserInput.startsWith(c + ' '));

    if (chosenCommand) e.emit(chosenCommand, trimmedUserInput);
    else console.log("Sorry, did't get that. Do man or help to see what I can do.");
};

cli.init = function () {
    console.log('\x1b[34m%s\x1b[0m', 'The CLI is running');
    var _interface = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: ''
    });
    _interface.prompt();

    _interface.on('line', function (str) {
        cli.processInput(str.trim().toLowerCase());
        _interface.prompt();
    });

    _interface.on('close', function () {
        process.exit(0);
    });
};

module.exports = cli;
