//      
const fs = require('fs');
const path = require('path');
const util = require('util');

const open = util.promisify(fs.open);
const writeFile = util.promisify(fs.writeFile);
const close = util.promisify(fs.close);
const ftruncate = util.promisify(fs.ftruncate);
const unlink = util.promisify(fs.unlink);
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);

const lib = {};

lib.create = async (dir        , file        , data        ) => {
    const descriptor = await open(dataFile(dir, file), 'wx');
    await writeFile(descriptor, JSON.stringify(data));
    await close(descriptor);
};

lib.read = async (dir        , file        )                  => readFile(dataFile(dir, file), 'utf8');

lib.update = async (dir        , file        , data        ) => {
    const descriptor = await open(dataFile(dir, file), 'r+');
    await ftruncate(descriptor, 0);
    await writeFile(descriptor, JSON.stringify(data));
    await close(descriptor);
};

lib.delete = async (dir        , file        ) => unlink(dataFile(dir, file));

lib.listFiles = async (dir        ) => readdir(dataDir(dir));

module.exports = lib;

const dataDir = (dir        ) => path.join(__dirname, '/../.data/') + dir;
const dataFile = (dir        , file        ) => dataDir(dir) + '/' + file + '.json'