//      
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
lib.baseDir = path.join(__dirname, '/../.data/');
lib.create = async (dir        , file        , data        ) => {
    const descriptor = await open(lib.baseDir + dir + '/' + file + '.json', 'wx');
    await writeFile(descriptor, JSON.stringify(data));
    await close(descriptor);
};

lib.read = async (dir        , file        )                  => readFile(lib.baseDir + dir + '/' + file + '.json', 'utf8');

lib.update = async (dir        , file        , data        ) => {
    const path = lib.baseDir + dir + '/' + file + '.json';
    const descriptor = await open(path, 'r+');
    await ftruncate(descriptor, 0);
    await writeFile(descriptor, JSON.stringify(data));
    await close(descriptor);
};

lib.delete = async (dir        , file        ) => unlink(lib.baseDir + dir + '/' + file + '.json');

module.exports = lib;