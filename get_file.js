var DHT = require('bittorrent-dht')
//async = require("async");
var PromisePool = require('es6-promise-pool');
var promiseRetry = require('promise-retry');
commandLineArgs = require('command-line-args');
const optionDefinitions = [{
        name: 'password',
        alias: 'p',
        type: String
    },
    {
        name: 'hashfile',
        alias: 'h',
        type: String
    },
    {
        name: 'outputfile',
        alias: 'o',
        type: String
    },
    {
        name: 'joblimit',
        alias: 'j',
        type: Number,
        defaultValue: 10
    }
];

options = commandLineArgs(optionDefinitions);

readFile(options['hashfile'])
  .then(function(data) {
    // carry on
    var hash_json = data;
    hashes = JSON.parse(hash_json);
    //console.log(hashes);
    //process.exit();
    chunks = [];

    var count = 0
    var promiseProducer = function () {
      //console.log('COUNT: ', count)
      if (count < hashes.length) {
        return promiseRetry(function (retry, number) {
          console.log('attempt number', number);
          var chunkPromise = getChunk(hashes[count][0], new Buffer(hashes[count][1]['data'], 'hex'))
          .catch(retry);
          count++;
          return chunkPromise;
        }, [3])
        .then(function (value) {
          //count++;
          return;
        }, function (err) {
          console.log('[!] Failed to load chunk. File may be incomplete.')
        });
      } else {
        return null
      }
    }
    const pool = new PromisePool(promiseProducer, options['joblimit'])

    pool.start()
      .then(() => {
        console.log('get file complete');
        //console.log(chunks);
        chunks.sort(sortFunction);
        //console.log(chunks);
        var recovered_file = new Buffer(0);
        //console.log(chunks);
        for(chunk_number in chunks) {
          //console.log(chunks[chunk_number][1])
          recovered_file = Buffer.concat([recovered_file, chunks[chunk_number][1]])
        }
        writeFile(options['outputfile'], recovered_file)
          .then(() => {
            console.log('file '+options['outputfile']+' successfully recovered');
          })
          .catch((err) => {
            throw err;
          })
      })
      .catch((err) => {
        throw err;
      })
  })
  .catch(function(err) {
    throw err;
  })

function readFile(file) {
  return new Promise((resolve, reject) => {
    var fs = require('fs');
    fs.readFile(options['hashfile'], (err, data) => {
      if(err) {
        reject(err);
      } else {
        resolve(data);
      }
    })
  })
}

function writeFile(filename, data) {
  return new Promise((resolve, reject) => {
    var fs = require('fs');
    fs.writeFile(filename, data, (err) => {
      if(err) {
        console.log('[!] Failed to get chunk: ', seq);
        reject(err);
      } else {
        resolve();
      }
    })
  })
}

function getChunk(seq, hash) {
    return new Promise(function(resolve, reject) {
        var dht = new DHT();
        console.log('getting '+seq+':');
        console.log(hash);
        dht.get(hash, (err, value) => {
          if (err || value == null) {
            if(value == null) {
              err = 'no value';
            }
            reject(err);
          } else {
              dht.destroy();
              console.log('Got Chunk '+ seq + ':');
              console.log(value.v);
              chunks.push([seq, value.v]);
              resolve(value);
          }
        })
    });
}

function sortFunction(a, b) {
    if (a[0] === b[0]) {
        return 0;
    } else {
        return (a[0] < b[0]) ? -1 : 1;
    }
}
