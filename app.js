var express = require ('express');
var app = express ();
var serv = require ('http').Server (app);

app.get ('/', function (req, res) {
    res.sendFile (__dirname + '/client/index.html');
});
app.use ('/client', express.static(__dirname + '/client'));

serv.listen (2000);
console.log ("Server started...");

var io = require ('socket.io') (serv,{});

io.sockets.on ('connection', function (socket){
    console.log ('socket connection');

    var player_position_x = 0;
    
    socket.on ('move x', function(data){
        player_position_x += 1 * data.input;
        console.log (player_position_x);
        send_position ();
    });

    function send_position () {
        socket.emit ('send position', {
            pos: player_position_x,
        });
    }
    
}); 