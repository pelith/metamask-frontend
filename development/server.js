var http = require('http');
var static = require('node-static');

var fileServer = new static.Server('./dist/frontend', {
  headers: {'Access-Control-Allow-Origin':'*'} 
});

http.createServer(function (request, response) {
    request.addListener('end', function () {
        fileServer.serve(request, response);
    }).resume();
}).listen(8080);
