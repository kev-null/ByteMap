var DHT = require('bittorrent-dht')
async = require("async");
var fs = require('fs');
var chunk_counter = 0;

commandLineArgs = require('command-line-args');
const optionDefinitions = [{
        name: 'password',
        alias: 'p',
        type: String
    },
    {
        name: 'file',
        alias: 'f',
        type: String
    },
    {
        name: 'delete_original',
        alias: 'd',
        type: Boolean
    },
    {
        name: 'chunksize',
        alias: 'c',
        type: Number,
        defaultValue: 950
    },
    {
        name: 'joblimit',
        alias: 'j',
        type: Number,
        defaultValue: 10
    }
];
options = commandLineArgs(optionDefinitions);

filename = options['file']
hashes = []
chunks = []
if(options['chunksize'] != 950) {
  console.log('[+] using chunk size of '+options['chunksize'])
}
function read_next_chunk(fd) {
    //console.log(fd)
    var chunk_size = options['chunksize']
    var chunk = new Buffer(chunk_size)
    fs.read(fd, chunk, 0, chunk.length, null, function(err, bytes_read, chunk) {
        if (err) {
            console.log(err)
            throw err;
        }
        // file read is complete
        if (bytes_read == 0) {
            //console.log('complete')
            fs.close(fd);
            if(options['delete_original']) {
              fs.unlink(filename, function() {
                console.log('[+] '+filename+" deleted")
              })
            }
            //console.log(chunks)
            process_chunks(chunks)
            return;
        }
        // check to see if our last chunk is smaller
        var data;
        if (bytes_read < chunk_size) {
            data = chunk.slice(0, bytes_read);
        } else {
            data = chunk;
        }
        //console.log(data)
        chunks.push([chunk_counter, data])
        //console.log(chunks)
        chunk_counter++
        read_next_chunk(fd);
    })
}

function process_chunks(chunks) {
    //console.log(chunks)
    async.eachLimit(chunks, options['joblimit'],
        function(chunk, callback) {
            //console.log(chunk[1].toString('hex'))
            //setTimeout(function(){ console.log(chunk); }, 3000);
            //var dht = new DHT();
            var dht = new DHT({bootstrap: true});
            //console.log(chunk[1].length)
            dht.put({
                v: chunk[1]
            }, function(err, hash, qty) {
                //if(err) console.log('err=', err);
                console.log('hash=', hash);
                console.log('qty=', qty);
                //hashes.push(hash)
                //console.log(chunks)
                //console.log(chunk_counter)
                dht.destroy()
                hashes.push([chunk[0], hash]);
                callback()
            })
        },
        function(err) {
            console.log('[+] all chunks uploaded')
            hashes.sort(sortFunction)
            //console.log(hashes)
            fs.writeFile(options['file']+'.hash', JSON.stringify(hashes), function(err) {
                if (err) {
                    throw err;
                }
                console.log("[+] hash file saved");
            })

            /*var encrypted_hashes = encrypt(new Buffer.from(JSON.stringify(hashes)));
            console.log(encrypted_hashes)
            */
            setInterval(function() {
                async.eachLimit(hashes, options['joblimit'],
                    function(hash, callback) {
                        console.log('[+] refreshing ' + hash[0] + '...')
                        var dht = new DHT({bootstrap: true});
                        //console.log('getting ' + hash[0])
                        dht.get(hash[1], function(err, value) {
                            //console.log('get_complete')
                            console.log(value.v)
                            //console.log(value.v)
                            dht.destroy()
                            //callback()
                            //console.log(decrypt(value.v))

                            var dht2 = new DHT({bootstrap: true});
                            //console.log('re-putting ' + hash[0])
                            dht2.put({
                                v: value.v
                            }, function(err, hash, qty) {
                                if (err) {
                                    throw err
                                } else {
                                    console.log('[+] successfully refreshed a chunk')
                                }
                                dht2.destroy()
                                callback()
                            })

                        })
                    },
                    function() {
                        console.log('[+] refresh complete')
                    })
            }, 600000)
        })
}

var crypto = require('crypto'),
    algorithm = 'aes-256-ctr',
    password = options['password'];

function encrypt(text) {
    var cipher = crypto.createCipher(algorithm, password)
    var crypted = cipher.update(text, 'utf8', 'hex')
    crypted += cipher.final('hex');
    return crypted;
}

function decrypt(text) {
    var decipher = crypto.createDecipher(algorithm, password)
    var dec = decipher.update(text, 'hex', 'utf8')
    dec += decipher.final('utf8');
    return dec;
}

function sortFunction(a, b) {
    if (a[0] === b[0]) {
        return 0;
    } else {
        return (a[0] < b[0]) ? -1 : 1;
    }
}

fs.open(filename, 'r', function(err, fd) {
    if (err) {
        throw err;
    }
    read_next_chunk(fd);
})
