var express = require ('express');
var app = express ();
var serv = require ('http').Server (app);

app.get ('/', function (req, res) {
    res.sendFile (__dirname + '/client/index.html');
});
app.use (express.static('client')); //Allows for access of static files from within the "client" folder

serv.listen (2000); //listens to port :2000
console.log ("Server started...");

var SOCKET_LIST = {}; //List of connections
var PLAYER_LIST = {}; //List of players

var io = require ('socket.io') (serv,{});

//Player Class
class Player {
   

    constructor (id, name,team) {
        this.id = id; //Player ID
        this.name = name; //Player Name
        this.team = team; //Player team

        this.x_position = 200; //Player position on the x-axis
        this.y_position = 200; //Player position on the y-axis

        this.maxHealth = 300; //Player maximum health
        this.currHealth = this.maxHealth; //Player CURRENT health

        this.moveSpeed = 5; //Player movement speed

        this.moveUpInput = false; //Is the player pressing 'W' key
        this.moveDownInput = false; //Is the player pressing 'S' key
        this.moveRightInput = false; //Is the player pressing 'D' key
        this.moveLeftInput = false; //Is the player pressing 'A' key

        //List of Functions:

        //Perferably don't touch or use these.

        //This is used to call all the functions in the list once every frame. 
        //Parameters (player)
        this.perFrameEvent = {}; 

        //This is used to call all the functions in the list everytime the player deals damage.
        //Parameters (player (this), player (damage taker), number (damage))
        this.onDealingDamageEvent = {}; 

        //This is used to call all the functions in the list everytime the player takes damage.
        //Parameters (player (this), player (damage dealer), number (damage))
        this.onTakingDamageEvent = {};

        //Status effects
        this.isDead = false; //This is death...
        this.isImmune = false; //This is when the player is immune to damage
        this.isUntargetable = false; //This is when the cannot be interacted with

        this.primaryAttack = false; //This is when the player uses left click to deal primary attack.
        this.secondaryAttack = false; //This is when the player uses right click to deal secondary attack.

        


    }

    //Called to deal damage to this player
    //damage is the number
    //dealer is the player doing the damage
    TakeDamage (damage, dealer) {

        if (!this.isImmune) //If the player is not immune to damage
            this.currHealth -= damage; //then subtract current health by damage
        else 
            damage = 0;

        if (this.currHealth <= 0) { //If the player's current health drops to 0
            this.currHealth = 0; //Current health never drops below 0
            this.Death ();      //and if the player drops below 0
        }

        return damage; //Return the damage incase it changes... somehow...
    }

   
    

    //Called to restore current health to this player
    //heal is the number
    //healer is the player doing the healing
    TakeHeal (heal, healer) {
        this.currHealth += heal; //add current health by heal

        if (this.currHealth > this.maxHealth) //If the player's health reaches its max
            this.currentHealth = this.maxHealth; //then cap it at the MaxHealth

        return heal; //Return the heal value incase it changes... somehow...
    }

    //Called when this player wants to deal damage
    //damage is the number
    //victim is the unfortunate player taking the damage
    DealDamage (damage, victim) {

        victim.TakeDamage (damage, this);
    }

    //Called when this player wants to heal
    //heal is the number
    //receiver is the player receiving the heal
    SendHeal (heal, receiver) {
        receiver.TakeDamage (heal, this)
    }


    //Called when the player drops to 0 current health
    Death () {
        this.isImmune = true;
        this.isDead = true;
        this.isUntargetable = true;
    }

}

//Please read Socket.io documentation as even I dont understand this
io.sockets.on ('connection', function (socket){
    socket.id = Math.random (); //creates a random ID for the new connection
    SOCKET_LIST [socket.id] = socket; //adds the new socket to the list
    var current_team ;//Created a var for current team . it will have 2 values.
    
    //If length is even it will assign to team 2 else if its odd then it will be assigned team1. 
    if(SOCKET_LIST.length % 2 ==0){ 
        current_team = 2;
    } else { 
        current_team=1;
    } 

    var player = new Player (socket.id,"Player " + socket.id, current_team); //constructs a new Player instance
    PLAYER_LIST [socket.id] = player; //adds the new player to the list

    console.log ('socket connection');
    
    socket.on ('disconnect',function(){ //When a player disconnects from the game
        delete SOCKET_LIST [socket.id]; //remove them from the player and the socket list
        delete PLAYER_LIST[socket.id];
        console.log ('socket disconnet');
    });

    socket.on ('sendMoveDirs',function (data) { //This is receive the data of the players movement input from the client
        PLAYER_LIST [socket.id].moveUpInput = data.moveDirections[0],
        PLAYER_LIST [socket.id].moveDownInput = data.moveDirections[1],
        PLAYER_LIST [socket.id].moveRightInput = data.moveDirections[2],
        PLAYER_LIST [socket.id].moveLeftInput = data.moveDirections[3]
    });
    socket.on ('sendAttackInput',function (data) { //This is to receive the data of the players attack choice input from the client
        PLAYER_LIST [socket.id].primaryAttack = data.attackTypeClick[0],
        PLAYER_LIST [socket.id].secondaryAttack = data.attackTypeClick[1]
    });


}); 

//This is the server's update function
//This does everything that's time based
//It is called 24 times a second
setInterval (function () {
    var movePack = []; //The list of all player's position as a packet.

    //This is called for every instance of player
    //Use it as gameplay update function for each player
    for (var i in PLAYER_LIST) {
        var player = PLAYER_LIST [i];

        //This move the player based on the input
        if (player.moveUpInput) {
            player.x_position += player.moveSpeed;
        } else if (player.moveDownInput) {
            player.x_position -= player.moveSpeed;            
        }

        if (player.moveRightInput) {
            player.y_position += player.moveSpeed;
        } else if (player.moveLeftInput) {
            player.y_position -= player.moveSpeed;            
        }

        //This adds the new position data to the list
        movePack.push ({
            x: player.x_position,
            y: player.y_position
        });

        
        
    }

    //This is called for every socket (connection)
    //This sends data to the client
    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST [i]; 
        socket.emit ('newPosition', movePack); //Sending position data to all connections about every player's position
    }

    
}, 1000/25);
