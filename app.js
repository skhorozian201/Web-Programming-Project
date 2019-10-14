var express = require ('express');
var app = express ();
var serv = require ('http').Server (app);

app.get ('/', function (req, res) {
    res.sendFile (__dirname + '/client/index.html');
});
app.use ('/client', express.static(__dirname + '/client'));

serv.listen (2000);
console.log ("Server started...");

var SOCKET_LIST = {};

var io = require ('socket.io') (serv,{});

class Player {

    constructor (id, name,) {
        this.id = id;
        this.name = name;

        this.maxHealth = 100;
        this.currHealth = this.maxHealth;
    }

}


io.sockets.on ('connection', function (socket){
    socket.id = Math.random ();
    socket.x = 200;
    socket.y = 200;

    SOCKET_LIST [socket.id] = socket;

    console.log ('socket connection');
    
    socket.on ('disconnect',function(){
        delete SOCKET_LIST [socket.id];
        console.log ('socket disconnet');
    });

    socket.on ('sendPosition',function (data){
        socket.x += data.x * 10,
        socket.y += data.y * 10  
    });
}); 

setInterval (function () {
    var pack = [];

    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST [i];

        pack.push ({
            x:socket.x,
            y:socket.y
        });

        
        
    }
    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST [i];
        socket.emit ('newPosition', pack);
    }

    
}, 1000/25);