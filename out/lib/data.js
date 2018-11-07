//      
const fs = require('fs');
const path = require('path');

const lib = {};
lib.baseDir = path.join(__dirname, '/../.data/');
lib.create = (dir        , file        , data        , callback                               ) => {
    fs.open(lib.baseDir + dir + '/' + file + '.json', 'wx', (err, descriptor) => {
        if (!err && descriptor) {
            const toWrite = JSON.stringify(data);
            fs.writeFile(descriptor, toWrite, (err) => {
                if (!err) {
                    fs.close(descriptor, (err) => callback(err ? 'Error closing new file ' + JSON.stringify(err) : false))
                } else callback('Error writing to the new file' + JSON.stringify(err));
            })
        }
        else {
            callback('Error: could not create a new file' + JSON.stringify(err));
        }
    })
};

lib.read = (dir        , file        , callback                                     ) => {
    fs.readFile(lib.baseDir + dir + '/' + file + '.json', 'utf8', (err, data) => callback(JSON.stringify(err), data));
};

lib.update = (dir        , file        , data        , callback                               ) => {
    fs.open(lib.baseDir + dir + '/' + file + '.json', 'r+', (err, descriptor) => {
        if (!err && descriptor) {
            fs.ftruncate(descriptor, (err) => {
                if (err) {
                    callback('error truncating file');
                }
                else {
                    fs.writeFile(descriptor, JSON.stringify(data), (err) => {
                        if (err) {
                            callback('could not write to a file');
                        } else {
                            fs.close(descriptor, (err) => {
                                if (err) {
                                    callback('error closing file')
                                }
                                callback(false);
                            })
                        }
                    })
                }
            })
        }
        else {
            callback('could not open the file, it may not exists yet');
        }
    });
};

lib.delete = (dir        , file        , callback                               ) => {
    fs.unlink(lib.baseDir + dir + '/' + file + '.json', (err)=>{callback(err||false);});
}

module.exports = lib;