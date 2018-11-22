// @flow
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
const appendFile = util.promisify(fs.appendFile);
const mkdir = util.promisify(fs.mkdir);

const lib = {};

async function create<T>(dir: string, file: string, data: Object|Array<T>){
    const descriptor = await open(dataFile(dir, file), 'wx');
    await writeFile(descriptor, JSON.stringify(data));
    await close(descriptor);
}

lib.create = create

lib.read = async (dir: string, file: string): Promise<string> => readFile(dataFile(dir, file), 'utf8');

async function update <T>(dir: string, file: string, data: Object|Array<T>) {
    const descriptor = await open(dataFile(dir, file), 'r+');
    await ftruncate(descriptor, 0);
    await writeFile(descriptor, JSON.stringify(data));
    await close(descriptor);
}

lib.update = update;

lib.delete = async (dir: string, file: string) => unlink(dataFile(dir, file));

lib.listFiles = async (dir: string) => readdir(dataDir(dir));

async function createOrUpdate<T>(dir: string, file: string, data: Object|Array<T>){
    try{
        await update(dir, file, data);
    }
    catch(e){
        await create(dir, file, data);
    }
}

lib.createOrUpdate = createOrUpdate;

async function createOrAppend(dir: string, file: string, data: any){
    await appendFile(dataDir(dir) + '/' + file + '.log', data);
}

lib.createOrAppend = createOrAppend;

lib.makeSureDirectoriesExist = async (...args: string[]) =>{
    return Promise.all(args.map(async path=>{
        const fullPath = dataDir(path);
        if(!fs.existsSync(fullPath)){
            await mkdir(fullPath);
        }
    }))
}

module.exports = lib;

const dataDir = (dir: string) => path.join(__dirname, '/../.data/') + dir;
const dataFile = (dir: string, file: string) => dataDir(dir) + '/' + file + '.json'