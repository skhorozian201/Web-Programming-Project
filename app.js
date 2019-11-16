var express = require ('express');
var app = express ();
var serv = require ('http').Server (app);

//the following is to connect to the mysql database for the login system
const mysqlDB = require('mysql');
const connection = mysqlDB.createConnection({
    host: 'localhost',
    username: 'username',
    password: 'password',
    database: 'mysql',
  });

  connection.connect((err) => { //exception in case we encounter an error.
    if(err){
      console.log('Cannot connect to DB at this time, please try again later.');
      return;
    }
    console.log('You are connected!');
  });

  connection.end((err) => {});
// You can query into the mysql database using this code
  con.query('INSERT INTO users SET ?', this.id, (err, res) => {
    if(err) throw err;
  });
  //I am supposed to do the same for password but im still not sure of the variables we shoud use.

app.get ('/', function (req, res) {
    res.sendFile (__dirname + '/client/index.html');
});
app.use (express.static('client')); //Allows for access of static files from within the "client" folder

serv.listen (2000); //listens to port :2000

console.log ("Server Initialized");

var SOCKET_LIST = {}; //List of connections
var PLAYER_LIST = {}; //List of players
var PROJECTILE_LIST = []; //List of projectiles

var io = require ('socket.io') (serv,{});

//Projectiles
class Projectile {
    constructor (x_init, y_init, angle, radius, speed, owner, lifetime) {
        this.x_position = x_init; //x position
        this.y_position = y_init; //y position

        this.x_velocity = (Math.cos(angle)) * speed; //x velocity
        this.y_velocity = (Math.sin(angle)) * speed; //y velocity

        this.radius = radius; //the radius of the projectile

        this.owner = owner; //The player that owns this

        this.lifetime = lifetime;
        this.age = 0;

        this.onCollisionEffect; //This function is called on collision with a player. (Player hit)
        this.onExpireEffect; //This function is called on expire. 

    }

    OnCollision (hit, i) { //This is called upon collision. Hit is the player hit.
        if (hit.team != this.owner.team){
            this.owner.DealDamage (20, hit);
            this.DestroyThis (i);
        }
    }

    DestroyThis (i) { //This destroys the projectile.
        PROJECTILE_LIST.splice (i, 1);
    }
}

class Spell { //Spell abstract class
    constructor () {
        this.spellCooldown = 1;
    }
     //spell cooldown

    SpellCast () { //function called when the spell is used.
    
    }

}

//Player Class
class Player {
   

    constructor (id, name,team) {
        this.id = id; //Player ID
        this.name = name; //Player Name
        this.team = team; //Player team

        if ( this.team == 2 ){
            this.x_position = 50; //Player position on the x-axis
            this.y_position = 50; //Player position on the y-axis
        } else {
            this.x_position = 780; //Player position on the x-axis
            this.y_position = 320; //Player position on the y-axis
        }

        this.radius = 60;

        this.maxHealth = 300; //Player maximum health
        this.currentHealth = this.maxHealth; //Player CURRENT health

        this.moveSpeed = 5; //Player movement speed

        this.moveUpInput = false; //Is the player pressing 'W' key
        this.moveDownInput = false; //Is the player pressing 'S' key
        this.moveRightInput = false; //Is the player pressing 'D' key
        this.moveLeftInput = false; //Is the player pressing 'A' key

        this.primaryAttack = false; //Is the player pressing Left Mouse
        this.secondaryAttack = false; //Is the player pressing Right Mouse
        
        this.mousePositionX = 0; //This is the y - coordinate for the current mouse positon.
        this.mousePositionY = 0; //This is the x - coordinate for the current mouse positon.

        this.actionTimer = 0;

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
    }

    PrimaryAttackFunc () {
        if (this.actionTimer <= 0) { //temporary attack function
            this.actionTimer = 15;

            var attackProjectile = new Projectile (this.x_position, this.y_position, 0, 40, 0, this, 15);

            PROJECTILE_LIST.push (attackProjectile);
        }
    }

    SecondaryAttackFunc () {
        if (this.actionTimer <= 0) { //temporary attack function
            this.actionTimer = 15;

            var angle = Math.atan2 (this.mousePositionY-this.y_position,this.mousePositionX-this.x_position);
            var attackProjectile = new Projectile (this.x_position, this.y_position, angle, 40, 30, this, 12);

            PROJECTILE_LIST.push (attackProjectile);
        }
    }

    CastSpell (spellNumb) {
        if (spellNumb == 0) {

        } else if (spellNumb == 1) {

        } else if (spellNumb == 2) {

        }
    }

    //Called to deal damage to this player
    //damage is the number
    //dealer is the player doing the damage
    TakeDamage (damage, dealer) {

        if (!this.isImmune) //If the player is not immune to damage
            this.currentHealth -= damage; //then subtract current health by damage
        else 
            damage = 0;

        if (this.currentHealth <= 0) { //If the player's current health drops to 0
            this.currentHealth = 0; //Current health never drops below 0
            this.Death ();      //and if the player drops below 0
        }

        return damage; //Return the damage incase it changes... somehow...
    }

   
    

    //Called to restore current health to this player
    //heal is the number
    //healer is the player doing the healing
    TakeHeal (heal, healer) {
        this.currentHealth += heal; //add current health by heal

        if (this.currentHealth >= this.maxHealth) //If the player's health reaches its max
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
        receiver.TakeHeal (heal, this);
    }


    //Called when the player drops to 0 current health
    Death () {
        this.isImmune = true;
        this.isDead = true;
        this.isUntargetable = true;
        console.log (this.name + "died.")
    }

}

//Use this function to get distance between two points
function GetDistance (x1, y1, x2, y2) {
    var final_x = x2-x1; 
    var final_y = y2-y1;

    return Math.sqrt (Math.pow(final_x,2) + Math.pow(final_y,2)); //Uses pythagorean theorem to find distance
}

var team1 = 0;//Number of players in team 1.
var team2 = 0;//Number of players in team 2.

io.sockets.on ('connection', function (socket){

    console.log ('socket connection');

    socket.on ("login", function (data){
        socket.id = Math.random (); //creates a random ID for the new connection
        SOCKET_LIST [socket.id] = socket; //adds the new socket to the list
        var current_team = 1 ;//Created a var for current team . it will have 2 values.
        //When we have a new connection. To decide the team we check which team has less players. and add that player to that team.
        if (team1 == team2){//if they are equal add that player to team 1.
            current_team = 1;
            team1 ++;
            
        } 
        else if (team1 > team2){//If players in team 1 are more than the players in team 2 . add the new player to team 2.
            current_team = 2;
            team2 ++;
        } 
        else if (team1 < team2){//If players in team 2 are more than the players in team 1 . add the new player to team 1.
            current_team = 1;
            team1 ++; 
        }
    

        var player = new Player (socket.id, data.username, current_team); //constructs a new Player instance
        PLAYER_LIST [socket.id] = player; //adds the new player to the list

        socket.emit ('sendResult', {
            connected: true,
            id: socket.id
        });

    });

    socket.on ('disconnect',function(){ //When a player disconnects from the game
        //Just to balance the teams , so next spawn is on the team with less players.
        if (PLAYER_LIST[socket.id].team == 1){//If the player is from team 2 , minus 1 from team2
            team1 --;
        }
        else if (PLAYER_LIST[socket.id].team == 2){//If player is from team1 minus 1 from team 1
            team2 --;
        } 
        delete SOCKET_LIST [socket.id]; //remove them from the player and the socket list
        delete PLAYER_LIST[socket.id];
        console.log ('socket disconnect');
    });

    socket.on ('sendMoveDirs',function (data) { //This is receive the data of the players movement input from the client
        PLAYER_LIST [socket.id].moveUpInput = data.moveDirections[0],
        PLAYER_LIST [socket.id].moveDownInput = data.moveDirections[1],
        PLAYER_LIST [socket.id].moveRightInput = data.moveDirections[2],
        PLAYER_LIST [socket.id].moveLeftInput = data.moveDirections[3]
    });
    socket.on ('sendAttackInput',function (data) { //This is to receive the data of the players attack choice input from the client
        PLAYER_LIST [socket.id].primaryAttack = data.primary,
        PLAYER_LIST [socket.id].secondaryAttack = data.secondary;
    });
    socket.on ('playerInitializationData', function (data) { //This is to recieve the misc. data of the players that doesn't fit anywhere above (I assume)
        PLAYER_LIST [socket.id].name = data.name;
    });
    socket.on('sendMousePosition', function (data) { //This is to recieve the data of the player's mouse positon.
        PLAYER_LIST [socket.id].mousePositionX = data.x;
        PLAYER_LIST [socket.id].mousePositionY = data.y;
    });
    socket.on ('sendSpellInput', function (data) { //This is to receive the player spell cast input.
        PLAYER_LIST [socket.id].CastSpell (data.spellNumber);
    });
}); 

//This is the server's update function
//This does everything that's time based
//It is called 24 times a second
setInterval (function () {
    var playerDataPack = []; //The list of all player's position as a packet.
    var projectileDataPack = []; //The list of all projectile data as a packet.

    //This is called for every instance of player
    //Use it as gameplay update function for each player
    for (var i in PLAYER_LIST) {
        var player = PLAYER_LIST [i];

        if (!player.isDead && player.actionTimer <= 0) {
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
        

            if (player.primaryAttack) {
                player.PrimaryAttackFunc ();
            }
            if (player.secondaryAttack) {
                player.SecondaryAttackFunc ();
            }

        }
        
        if (player.actionTimer > 0) {
            player.actionTimer--;
        }

        //This adds the new position data to the list
        playerDataPack.push ({
            x: player.x_position,
            y: player.y_position,
            name: player.name,
            team: player.team,
            maxHealth: player.maxHealth,
            currentHealth: player.currentHealth,
            id: player.id
        });
        
    }

    for (var i in PROJECTILE_LIST) {
        var projectile = PROJECTILE_LIST [i];

        //Projectile movement.
        projectile.x_position += projectile.x_velocity;
        projectile.y_position += projectile.y_velocity;

        //This checks for collision every frame with every player.
        for (var i in PLAYER_LIST) {
            var player = PLAYER_LIST [i];

            if (player != projectile.owner) {
                if (GetDistance(player.x_position ,player.y_position, projectile.x_position, projectile.y_position) <= projectile.radius + player.radius) {
                    projectile.OnCollision (player, i);
                }
            }
        }

        //Projectile data to be sent to the client
        projectileDataPack.push ({
            x: projectile.x_position,
            y: projectile.y_position,
            rad: projectile.radius
        });


        if (projectile.age > projectile.lifetime) {
            projectile.DestroyThis (i);
        } else {
            projectile.age++;
        }
    }

    var dataPackage = {playerDataPack, projectileDataPack};

    //This is called for every socket (connection)
    //This sends data to the client
    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST [i];
        socket.emit ('sendPositionData', dataPackage); //Sending position data to all connections about every player's position
    }

    
}, 1000/25);
