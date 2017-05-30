var DHT = require('bittorrent-dht')
var dht = new DHT()

var hash = new Buffer('480fee5a496275b29094347d60e0d1c8c0b09e55', 'hex');

dht.get(hash, function(err, value) {
  console.log(err)
  console.log(value)
  //dht2.destroy()
  //process.exit()
})
