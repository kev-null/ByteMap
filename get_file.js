var DHT = require('bittorrent-dht')
async = require("async");
var fs = require('fs');

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
        name: 'joblimit',
        alias: 'j',
        type: Number,
        defaultValue: 10
    }
];

options = commandLineArgs(optionDefinitions);
fs.readFile(options['hashfile'], function(err, data) {
  if (err) throw err;
  var hash_json = data;
  var hashes = JSON.parse(hash_json);
  //console.log(new Buffer(hashes[0][1]['data'], 'hex'));

  var chunks = [];
  async.eachLimit(hashes, options['joblimit'],
      function(hash, callback) {
          var dht = new DHT({bootstrap: true});
          console.log('getting ' + hash[0])
          dht.get(new Buffer(hash[1]['data'], 'hex'), function(err, value) {
              //if(err) throw err;
              console.log(value.v)
              chunks.push([hash[0], value.v])
              dht.destroy();
              callback();
          })
      },
      function() {
          console.log('get file complete');
          chunks.sort(sortFunction);
          var recovered_file = new Buffer(0);
          //console.log(chunks);
          for(chunk_number in chunks) {
            //console.log(chunks[chunk_number][1])
            recovered_file = Buffer.concat([recovered_file, chunks[chunk_number][1]])
          }
          fs.writeFile(options['hashfile']+'.jpg', recovered_file, function(err) {
            if(err) throw err;
          })
      })

});

function sortFunction(a, b) {
    if (a[0] === b[0]) {
        return 0;
    } else {
        return (a[0] < b[0]) ? -1 : 1;
    }
}
