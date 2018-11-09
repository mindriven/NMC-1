// @flow
const fs = require('fs');
const path = require('path');
const util = require('util');

const open = util.promisify(fs.open);
const writeFile = util.promisify(fs.writeFile);
const close = util.promisify(fs.close);
const ftruncate = util.promisify(fs.ftruncate);
const unlink = util.promisify(fs.unlink);
const readFile = util.promisify(fs.readFile);

const lib = {};

lib.create = async (dir: string, file: string, data: Object) => {
    const descriptor = await open(dataFile(dir, file), 'wx');
    await writeFile(descriptor, JSON.stringify(data));
    await close(descriptor);
};

lib.read = async (dir: string, file: string): Promise<string> => readFile(dataFile(dir, file), 'utf8');

lib.update = async (dir: string, file: string, data: Object) => {
    const descriptor = await open(dataFile(dir, file), 'r+');
    await ftruncate(descriptor, 0);
    await writeFile(descriptor, JSON.stringify(data));
    await close(descriptor);
};

lib.delete = async (dir: string, file: string) => unlink(dataFile(dir, file));

module.exports = lib;

const dataFile = (dir: string, file: string) => path.join(__dirname, '/../.data/') + dir + '/' + file + '.json'