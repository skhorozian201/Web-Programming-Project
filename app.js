var express = require ('express');
var app = express ();
var serv = require ('http').Server (app);

var MongoClient = require('mongodb').MongoClient;
var dburl = "mongodb://localhost:27017/mydb";

app.get ('/', function (req, res) {
    res.sendFile (__dirname + '/client/index.html');
});


app.use (express.static('client')); //Allows for access of static files from within the "client" folder

serv.listen (2000); //listens to port :2000

console.log ("Server Initialized");
  
var baseUserLogin = {
    username: 'username',
    password: 'password'
};

var SOCKET_LIST = {}; //List of connections
var PLAYER_LIST = {}; //List of players
var PROJECTILE_LIST = []; //List of projectiles
var PARTICLE_EFFECT_LIST = []; //List of particle

var io = require ('socket.io') (serv,{});

class ParticleEffect {
    constructor (x_pos, y_pos, owner, lifetime, id) {
        this.x_pos = x_pos;//x position
        this.y_pos = y_pos;//y position
        this.owner = owner;//the player this effect belongs to
        this.lifetime = lifetime; //how long the particle can last
        this.age = 0; //current age of the particle
        this.id = id;//which particle effect it is
    }

    UpdateFunc () {//this is called every frame update

    }
}

class FollowPlayerEffect extends ParticleEffect{
    constructor (x_pos, y_pos, owner, lifetime, id) {
        super (x_pos, y_pos, owner, lifetime, id);
    }

    UpdateFunc () {//this particle effect follows its owner. Owner doesnt have to be the player that created it
        this.x_pos = this.owner.x_position;
        this.y_pos = this.owner.y_position;
    }
}

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

        this.id = 0;
    }

    OnCollision (hit, i) { //This is called upon collision. Hit is the player hit.
        if (hit.team != this.owner.team){
            this.owner.DealDamage (25, hit);
        }
    }

    DestroyThis (i) { //This destroys the projectile.
        PROJECTILE_LIST.splice (i, 1);
    }
}

class PaladinPrimary extends Projectile {
    constructor (x_init, y_init, angle, radius, speed, owner, lifetime) {
        super (x_init, y_init, angle, radius, speed, owner, lifetime);
        this.id = 0;
    }

    OnCollision (hit, i) { //This is called upon collision. Hit is the player hit.
        if (hit.team != this.owner.team){
            this.owner.DealDamage (20, hit);
        }
    }

    
}

class PaladinSecondary extends Projectile {
    constructor (x_init, y_init, angle, radius, speed, owner, lifetime) {
        super (x_init, y_init, angle, radius, speed, owner, lifetime);
    }

    OnCollision (hit, i) { //This is called upon collision. Hit is the player hit.
        if (hit.team != this.owner.team){
            this.owner.DealDamage (20, hit);
            this.DestroyThis (i);
        }
    }
}

class PaladinShockWave extends Projectile {
    constructor (x_init, y_init, angle, radius, speed, owner, lifetime) {
        super (x_init, y_init, angle, radius, speed, owner, lifetime);
        this.id = -1;
    }

    OnCollision (hit, i) { //This is called upon collision. Hit is the player hit.
        if (hit.team != this.owner.team){
            this.owner.DealDamage (30, hit);
            hit.TakeStun (37);
        }
    }
}

class MageUltProjectile extends Projectile {
    constructor (x_init, y_init, angle, radius, speed, owner, lifetime) {
        super (x_init, y_init, angle, radius, speed, owner, lifetime);
        this.id = 3;
    }

    OnCollision (hit, i) { //This is called upon collision. Hit is the player hit.
        if (hit.team != this.owner.team){
            this.owner.DealDamage (5, hit);
        }
    }
}

class MagePrimary extends Projectile {
    constructor (x_init, y_init, angle, radius, speed, owner, lifetime) {
        super (x_init, y_init, angle, radius, speed, owner, lifetime);
        this.id = 1;
    }

    OnCollision (hit, i) { //This is called upon collision. Hit is the player hit.
        if (hit.team != this.owner.team){
            this.owner.DealDamage (10, hit);
            if (this.owner.currentManaBuildUp < 5)
                this.owner.currentManaBuildUp += 1;
            this.DestroyThis (i);
        }
    }
}

class MageSecondary extends Projectile {
    constructor (x_init, y_init, angle, radius, speed, owner, lifetime, manaBuildUp) {
        super (x_init, y_init, angle, radius, speed, owner, lifetime);
        this.id = 2;
        this.manaBuildUp = manaBuildUp;
    }

    OnCollision (hit, i) { //This is called upon collision. Hit is the player hit.
        if (hit.team != this.owner.team){
            this.owner.DealDamage (10 + (10 * this.manaBuildUp), hit);
            this.DestroyThis (i);
        }
    }
}

class ArcherArrow extends Projectile {
    constructor (x_init, y_init, angle, radius, speed, owner, lifetime) {
        super (x_init, y_init, angle, radius, speed, owner, lifetime);
        this.id = 4;
    }

    OnCollision (hit, i) { //This is called upon collision. Hit is the player hit.
        if (hit.team != this.owner.team){
            this.owner.DealDamage (20, hit);
            this.DestroyThis (i);
        }
    }
}

class ArcherUltProjectile extends Projectile {
    constructor (x_init, y_init, angle, radius, speed, owner, lifetime) {
        super (x_init, y_init, angle, radius, speed, owner, lifetime);
        this.id = 5;
    }

    OnCollision (hit, i) { //This is called upon collision. Hit is the player hit.
        if (hit.team != this.owner.team){
            if (hit.currentHealth/hit.maxHealth <= 0.5) {
                hit.currentHealth = 0;
                this.owner.DealDamage (1,hit);
            }
            this.DestroyThis (i);
        }
    }
}

class Spell { //Spell abstract class
    constructor () {
        this.spellCooldown = 0;//spell cooldown
    }

    SpellOnInitialization (caster) {

    }

    SpellCast (target, caster) { //function called when the spell is used.
        
    }

}

class PaladinHeal extends Spell {
    constructor () {
        super ();
        this.spellCooldown = 0;
    }

    SpellOnInitialization (caster) {
        
    }

    SpellCast (caster) {
        caster.spellTimer = 15;
        this.spellCooldown = 250;

        var effect = new FollowPlayerEffect (caster.x_position, caster.y_position, caster, 15, 0);
        PARTICLE_EFFECT_LIST.push (effect);

        setTimeout ( function () {
            caster.SendHeal ((caster.maxHealth - caster.currentHealth) * 0.35,caster);
            caster.stunTimer = 0;
        }, 150);
    }
}

class PaladinDash extends Spell {
    constructor () {
        super ();
        this.spellCooldown = 0;
        this.x_velo = 0;
        this.y_velo = 0;
        this.framesLeft = 0;
    }

    SpellOnInitialization (caster) {
        caster.perFrameEvent.push (this.FrameMovement);
    }

    SpellCast (caster) {
        var angle = Math.atan2 (caster.mousePositionY-caster.y_position,caster.mousePositionX-caster.x_position);
        this.x_velo = (Math.cos(angle));
        this.y_velo = (Math.sin(angle));
        this.framesLeft = 10;
        caster.spellTimer = 10;
        this.spellCooldown = 200;
    }

    FrameMovement (caster) {
        if (caster.spell2.framesLeft > 0) {
            caster.x_position += caster.spell2.x_velo * 20;
            caster.y_position += caster.spell2.y_velo * 20;
            if (caster.spell2.framesLeft == 1) {
                var shockWave = new PaladinShockWave (caster.x_position, caster.y_position, 0, 125, 0, caster, 0);
                var effect = new ParticleEffect (caster.x_position, caster.y_position, caster, 25, 1);

                PARTICLE_EFFECT_LIST.push (effect);
                PROJECTILE_LIST.push (shockWave);
            }
            caster.spell2.framesLeft--;
        }
    }
}

class PaladinUlt extends Spell {
    constructor () {
        super ();
        this.spellCooldown = 0;

        this.isActive = false;
    }

    SpellOnInitialization (caster) {
        caster.onTakingDamageEvent.push (this.DamageReflection);
    }

    SpellCast (caster) {
        this.spellCooldown = 500;
        this.isActive = true;

        var effect = new FollowPlayerEffect (caster.x_position,caster.y_position,caster, 125, 2);
        PARTICLE_EFFECT_LIST.push (effect);

        setTimeout(() => {
            this.isActive = false;
        }, 5000);
    }

    DamageReflection (player, dealer, damage) {

        if (player.spell3.isActive){
            player.DealDamage (damage * 0.66,dealer);
        }
    }
}

class MageBarrier extends Spell {
    constructor () {
        super ();
        this.spellCooldown = 0;

        this.isActive = false;
    }

    SpellOnInitialization (caster) {
        caster.onTakingDamageEvent.push (this.Barrier);
    }

    SpellCast (caster) {
        this.spellCooldown = 250;
        this.isActive = true;

        var effect = new FollowPlayerEffect (caster.x_position,caster.y_position,caster, 50, 3);
        PARTICLE_EFFECT_LIST.push (effect);

        setTimeout(() => {
            this.isActive = false;
        }, 2000);
    }

    Barrier (player, dealer, damage) {

        if (player.spell1.isActive){
            player.SendHeal (damage * 2, player);
            player.manaBuildUp = 5;
        }
    }
}

class MageTeleport extends Spell {
    constructor () {
        super ();
        this.spellCooldown = 0;
    }

    SpellOnInitialization (caster) {
        
    }

    SpellCast (caster) {
        caster.spellTimer = 15;
        var x_tele = caster.x_position - caster.mousePositionX;
        var y_tele = caster.y_position - caster.mousePositionY;
        this.spellCooldown = 125;

        if (x_tele > 500)
            x_tele = 500;
        else if (x_tele < -500)
            x_tele = -500;

        if (y_tele > 500)
            y_tele = 500;
        else if (y_tele < -500)
            y_tele = -500;


        setTimeout ( function () {
            caster.x_position -= x_tele;
            caster.y_position -= y_tele;
        }, 150);
    }
}

class MageUlt extends Spell {
    constructor () {
        super ();
        this.spellCooldown = 0;
    }

    SpellOnInitialization (caster) {
        
    }

    SpellCast (caster) {
        caster.spellTimer = 25;
        this.spellCooldown = 375;

        setTimeout ( function () {
            var projectile = new MageUltProjectile (caster.x_position, caster.y_position, 0, 450, 0, caster, 100);

            PROJECTILE_LIST.push (projectile);
        }, 1000);
    }
}

class ArcherQ extends Spell {
    constructor () {
        super ();
        this.spellCooldown = 0;
    }

    SpellOnInitialization (caster) {
        
    }

    SpellCast (caster) {
        this.spellCooldown = 375;

        var effect = new FollowPlayerEffect (caster.x_position, caster.y_position, caster, 100, 4);
        PARTICLE_EFFECT_LIST.push (effect);

        caster.attackSpeed = 3;

        setTimeout ( function () {
            caster.attackSpeed = 1;
        }, 4000);
    }
}

class ArcherMark extends Spell {
    constructor () {
        super ();
        this.spellCooldown = 0;
        this.target = null;
        this.effect = null;
    }

    SpellOnInitialization (caster) {
        caster.onDealingDamageEvent.push (this.MarkTarget);
    }

    SpellCast (caster) {
        if (this.target != null){
            this.spellCooldown = 200;
            this.target.TakeStun (50);

            this.target = null;
            this.effect.owner = null;
            this.effect = null;
        }
    }

    MarkTarget (caster, target, damage) {
        if (caster.spell2.effect != null){
            caster.spell2.effect.owner = null;
        }
        caster.spell2.effect = new FollowPlayerEffect (caster.x_position, caster.y_position, target, 1000000, 5);
        PARTICLE_EFFECT_LIST.push (caster.spell2.effect);
        caster.spell2.target = target;
    }
}

class ArcherUlt extends Spell {
    constructor () {
        super ();
        this.spellCooldown = 0;
    }

    SpellOnInitialization (caster) {
        
    }

    SpellCast (caster) {
        caster.spellTimer = 25;
        this.spellCooldown = 500;

        var angle = Math.atan2 (caster.mousePositionY-caster.y_position,caster.mousePositionX-caster.x_position);
        var projectile = new ArcherUltProjectile (caster.x_position, caster.y_position, angle, 50, 75, caster, 25);


        setTimeout ( function () {

            PROJECTILE_LIST.push (projectile);
        }, 1000);
    }
}

//Player Class
class Player {

    constructor (id, name,team) {
        this.id = id; //Player ID
        this.name = name; //Player Name
        this.team = team; //Player team
        this.kills = 0;//PLayer total kills. Start from 0

        if ( this.team == 2 ){
            this.x_position = 95; //Player position on the x-axis
            this.y_position = 130; //Player position on the y-axis
        } else {
            this.x_position = 880; //Player position on the x-axis
            this.y_position = 435; //Player position on the y-axis
        }

        this.class = "None";

        this.radius = 60; //hitbox radius

        this.maxHealth = 250; //Player maximum health
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

        this.actionTimer = 0; //This is how long the player is not allowed to attack.
        this.spellTimer = 0; //This is how long the player is casting a spell for.

        this.stunTimer = 0; //This is how long the player is disallowed to act.

        //List of Functions:

        //Perferably don't touch or use these.

        //This is used to call all the functions in the list once every frame. 
        //Parameters (player)
        this.perFrameEvent = []; 

        //This is used to call all the functions in the list everytime the player deals damage.
        //Parameters (player (this), player (damage taker), number (damage))
        this.onDealingDamageEvent = []; 

        //This is used to call all the functions in the list everytime the player takes damage.
        //Parameters (player (this), player (damage dealer), number (damage))
        this.onTakingDamageEvent = [];

        
        //Class Spells
        this.spell1 = new Spell (); //Construct spells for the player
        this.spell2 = new Spell (); 
        this.spell3 = new Spell ();

        this.spell1.SpellOnInitialization (this); //Calls their initialization function
        this.spell2.SpellOnInitialization (this);
        this.spell3.SpellOnInitialization (this);

        //Status effects
        this.isDead = false; //This is death...
        this.isImmune = false; //This is when the player is immune to damage
        this.isUntargetable = false; //This is when the cannot be interacted with
    }

    PrimaryAttackFunc () {

    }

    SecondaryAttackFunc () {

    }

    CastSpell (spellNumb) {
        if (spellNumb == 0) {
            if (this.spell1.spellCooldown <= 0 && this.stunTimer <= 0 && this.spellTimer <= 0 && !this.isDead)
                this.spell1.SpellCast (this);
        } else if (spellNumb == 1) {
            if (this.spell2.spellCooldown <= 0 && this.stunTimer <= 0 && this.spellTimer <= 0 && !this.isDead)
                this.spell2.SpellCast (this);
        } else if (spellNumb == 2) {
            if (this.spell3.spellCooldown <= 0 && this.stunTimer <= 0 && this.spellTimer <= 0 && !this.isDead)
                this.spell3.SpellCast (this);
        }
    }

    //Called to deal damage to this player
    //damage is the number
    //dealer is the player doing the damage
    TakeDamage (damage, dealer) {

        if (!this.isImmune){ //If the player is not immune to damage
            this.currentHealth -= damage; //then subtract current health by damage
            if (this.currentHealth <= 0) { //If the player's current health drops to 0
                this.currentHealth = 0; //Current health never drops below 0
                dealer.kills ++; //Give the dealer a kill
                if (dealer.team == 1){//If the dealer is from team 1 , give them a point
                    team1Score ++;
                }
                else if (dealer.team == 2){//If dealer is from team2 , give them a point
                    team2Score ++ ;
                }
                this.Death ();//Call death function on current player
                
            }

            for (var i in this.onTakingDamageEvent) { //this calls on damage taken event
                func = this.onTakingDamageEvent [i];

                func (this, dealer, damage);
            }
        }
        else {
            damage = 0;
        }


        return damage; //Return the damage incase it changes... somehow...
    }


    //Called to restore current health to this player
    //heal is the number
    //healer is the player doing the healing
    TakeHeal (heal, healer) {
        if (!this.isDead){
            this.currentHealth += heal; //add current health by heal

            if (this.currentHealth >= this.maxHealth) //If the player's health reaches its max
                this.currentHealth = this.maxHealth; //then cap it at the MaxHealth

            return heal; //Return the heal value incase it changes... somehow...
        } else 
            return 0;
    }

    //Called when this player wants to deal damage
    //damage is the number
    //victim is the unfortunate player taking the damage
    DealDamage (damage, victim) {
        victim.TakeDamage (damage, this);

        for (var i in this.onDealingDamageEvent) { //this calls on damage taken event
            func = this.onDealingDamageEvent [i];

            func (this, victim, damage);
        }
    }

    //Called when this player wants to heal
    //heal is the number
    //receiver is the player receiving the heal
    SendHeal (heal, receiver) {
        receiver.TakeHeal (heal, this);
    }

    TakeStun (duration) {
        if (this.stunTimer < duration) {
            this.stunTimer = duration;
        }
    }


    //Called when the player drops to 0 current health
    Death () {
        this.isImmune = true;//Kepp them immune for 5 seconds
        this.isDead = true;//Keep them //dead for 5 seconds
        this.isUntargetable = true;//Cant hit them
        console.log (this.name + " died.");     

        if (team2Score == 10 || team1Score == 10){//Whoever reaches 10 points wins
            for (var i in SOCKET_LIST) {
                var socket = SOCKET_LIST [i];
                var player = PLAYER_LIST[i]
                var pack = {team1,team1Score,team2,team2Score,player}
                socket.emit('gameOver',pack)//Catch that on html side and end the game
            }
            console.log("GameOver")
            io.sockets.server.close();//Closes the game.
        }  
        this.Respawn ();
    }

    Respawn(){//Respawn   
            setTimeout(function (player) {//Gives a 5 sec delay before executing the function.
                console.log ("Respawning " + player.name);
                player.isImmune = false;
                player.isDead = false;
                player.isUntargetable = false

                if ( player.team == 2 ){
                    player.x_position = 95; //Player position on the x-axis
                    player.y_position = 130; //Player position on the y-axis
                } else {
                    player.x_position = 880; //Player position on the x-axis
                    player.y_position = 435; //Player position on the y-axis
                }

                player.currentHealth = player.maxHealth;
            }, 5000, this);
        
    }

}

//Paladin Player Subclass
class Paladin extends Player {
    constructor (id, name,team) {
        super (id, name, team);
        
        this.class = "Paladin";

        this.maxHealth = 500; //Player maximum health
        this.currentHealth = this.maxHealth; //Player CURRENT health

        this.spell1 = new PaladinHeal ();
        this.spell2 = new PaladinDash ();
        this.spell3 = new PaladinUlt ();

        this.spell1.SpellOnInitialization (this); //Calls their initialization function
        this.spell2.SpellOnInitialization (this);
        this.spell3.SpellOnInitialization (this);
    }

    PrimaryAttackFunc () {
        if (this.actionTimer <= 0) { 
            this.actionTimer = 15;

            var angle = Math.atan2 (this.mousePositionY-this.y_position,this.mousePositionX-this.x_position);

            var range_x = 100 * Math.cos (angle);
            var range_y = 100 * Math.sin (angle);
            var attackProjectile = new PaladinPrimary (this.x_position + range_x, this.y_position + range_y, 0, 60, 0, this, 0);

            setTimeout ( function () {
                PROJECTILE_LIST.push (attackProjectile);
            }, 150);
        }
    }

    SecondaryAttackFunc () {
        if (this.actionTimer <= 0) { 
            this.actionTimer = 25;
            var angle = Math.atan2 (this.mousePositionY-this.y_position,this.mousePositionX-this.x_position);
            var attackProjectile = new PaladinSecondary (this.x_position, this.y_position, angle, 40, 30, this, 12);

            setTimeout ( function () {
                PROJECTILE_LIST.push (attackProjectile);
            }, 250);
        }
    }
}

class Mage extends Player {
    constructor (id, name,team) {
        super (id, name, team);

        this.class = "Mage"
        this.maxHealth = 300; //Player maximum health
        this.currentHealth = this.maxHealth; //Player CURRENT health

        this.spell1 = new MageBarrier ();
        this.spell2 = new MageTeleport ();
        this.spell3 = new MageUlt ();

        this.spell1.SpellOnInitialization (this); //Calls their initialization function
        this.spell2.SpellOnInitialization (this);
        this.spell3.SpellOnInitialization (this);

        this.currentManaBuildUp = 0;
    }

    PrimaryAttackFunc () {
        if (this.actionTimer <= 0) { //temporary attack function
            this.actionTimer = 10;

            var angle = Math.atan2 (this.mousePositionY-this.y_position,this.mousePositionX-this.x_position);
            var attackProjectile = new MagePrimary (this.x_position, this.y_position, angle, 25, 30, this, 20);


            setTimeout (function () {

                PROJECTILE_LIST.push (attackProjectile);
            },10);
        }
    }

    SecondaryAttackFunc () {
        if (this.actionTimer <= 0) { //temporary attack function
            this.actionTimer = 15;
            var angle = Math.atan2 (this.mousePositionY-this.y_position,this.mousePositionX-this.x_position);
            var attackProjectile = new MageSecondary (this.x_position, this.y_position, angle, 10 + 10 * this.currentManaBuildUp, 10 + 8 * this.currentManaBuildUp, this, 15, this.currentManaBuildUp);
            this.currentManaBuildUp = 0;


            setTimeout (function () {
 
                PROJECTILE_LIST.push (attackProjectile);
            },10);
        }
    }
}

class Archer extends Player {
    constructor (id, name,team) {
        super (id, name, team);

        this.class = "Archer"
        this.maxHealth = 350; //Player maximum health
        this.currentHealth = this.maxHealth; //Player CURRENT health

        this.spell1 = new ArcherQ ();
        this.spell2 = new ArcherMark ();
        this.spell3 = new ArcherUlt ();

        this.spell1.SpellOnInitialization (this); //Calls their initialization function
        this.spell2.SpellOnInitialization (this);
        this.spell3.SpellOnInitialization (this);

        this.attackSpeed = 1;
    }

    PrimaryAttackFunc () {
        if (this.actionTimer <= 0) { //temporary attack function
            this.actionTimer = 15/this.attackSpeed;

            var angle = Math.atan2 (this.mousePositionY-this.y_position,this.mousePositionX-this.x_position);
            var attackProjectile = new ArcherArrow (this.x_position, this.y_position, angle, 25, 30, this, 20);

            setTimeout (function () {
                PROJECTILE_LIST.push (attackProjectile);
            },10);
        }
    }

    SecondaryAttackFunc () {
        if (this.actionTimer <= 0) { //temporary attack function
            this.actionTimer = 35/this.attackSpeed;
            var angle = Math.atan2 (this.mousePositionY-this.y_position,this.mousePositionX-this.x_position);
            var attackProjectile1 = new ArcherArrow (this.x_position, this.y_position, angle, 20, 50, this, 10);
            var attackProjectile2 = new ArcherArrow (this.x_position, this.y_position, angle-0.2, 20, 50, this, 15);
            var attackProjectile3 = new ArcherArrow (this.x_position, this.y_position, angle+0.2, 20, 50, this, 15);

            setTimeout (function () {
                PROJECTILE_LIST.push (attackProjectile1);
                PROJECTILE_LIST.push (attackProjectile2);
                PROJECTILE_LIST.push (attackProjectile3);
            },10);
        }
    }
}

//Use this function to get distance between two points
function GetDistance (x1, y1, x2, y2) {
    var final_x = x2-x1; 
    var final_y = y2-y1;

    return Math.sqrt (Math.pow(final_x,2) + Math.pow(final_y,2)); //Uses pythagorean theorem to find distance
}

var team1 = 0;//Number of players in team 1.
var team1Score = 0;//Holds the kills of the team 1.
var team2 = 0;//Number of players in team 2.
var team2Score = 0 //Holds the kills of team 2


io.sockets.on ('connection', function (socket){
    
    console.log ('socket connection');

    socket.on("signup",function(data){
        MongoClient.connect(dburl, function(err, db) {
            if (err) throw err;
            var database = db.db("mydb");

            //after connecting check the login credentials
            database.collection("users").find({}).toArray(function(err, result) {
                if (err) throw err;
                var found = false;                 
                for (x in result) {
                    ress = result[x]                    
                    if (ress.username == data.username  ) {
                        SendResult (false,false); 
                        console.log("Username Already Taken");
                        found = true;
                        break;
                    } 
                };
                if(!found){
                    database.collection("users").insertOne(data, function(err, res) {
                        if (err) throw err;
                        console.log(data.username + " Signed UP");
                        CreatePlayer(data);
                        SendResult(true,true);
                        db.close();
                        });
                }
            });
        });
    });

    
    socket.on ("login", function (data){

        //on logging in try to connect to the database
        MongoClient.connect(dburl, function(err, db) {
            if (err) throw err;
            var database = db.db("mydb");

            //after connecting check the login credentials
            database.collection("users").find({}).toArray(function(err, result) {
                if (err) throw err;
                var found = false;            
                for (x in result) {
                    ress = result[x];                    
                    if (ress.username == data.username && ress.password == data.password) {
                        CreatePlayer(data);
                        SendResult (true,true); //if the login credentials are correct, create a player and send result to the client
                        found = true;
                        break;
                    } 
                };
                if(!found){
                    console.log("Cant find Username");
                    SendResult (false,true); //otherwise just send result to the client
                }
            });

        });
    });

    function CreatePlayer (data) {
        console.log ("Created player");

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
    
        if (data.class == "paladin")
            var player = new Paladin (socket.id, data.username, current_team); //constructs a new Player instance
        else if (data.class == "mage")
            var player = new Mage (socket.id, data.username, current_team); 
        else if (data.class == "archer")
            var player = new Archer (socket.id, data.username, current_team); 

        
        PLAYER_LIST [socket.id] = player; //adds the new player to the list
    }

    function SendResult (loginSuccess,usernameAvailable) { //This sends the result of the login.Created another paramter for signup. To display if the username is take or not.
        if(loginSuccess){
            var player = PLAYER_LIST[socket.id]
            socket.emit ('sendResult', {
                connected: loginSuccess,
                id: socket.id,
                player : player
            }); 
        }
        else{
            socket.emit ('sendResult', {
                connected: loginSuccess,
                username:usernameAvailable,
                id: socket.id
            });             
        }
    }

    socket.on ('disconnect',function(){ //When a player disconnects from the game
        //Just to balance the teams , so next spawn is on the team with less players.
        if (PLAYER_LIST[socket.id]){
            if (PLAYER_LIST[socket.id].team == 1){//If the player is from team 2 , minus 1 from team2
                team1 --;
            }
            else if (PLAYER_LIST[socket.id].team == 2){//If player is from team1 minus 1 from team 1
                team2 --;
            } 
            delete SOCKET_LIST [socket.id]; //remove them from the player and the socket list
            console.log (PLAYER_LIST[socket.id].name + ' disconnected');
            delete PLAYER_LIST[socket.id];
        }
        else {
            console.log ('socket disconnected');
        }
    });

    socket.on ('sendMoveDirs',function (data) { //This is receive the data of the players movement input from the client  
        PLAYER_LIST [socket.id].moveUpInput = data.moveDirections[0],
        PLAYER_LIST [socket.id].moveDownInput = data.moveDirections[1],
        PLAYER_LIST [socket.id].moveRightInput = data.moveDirections[2],
        PLAYER_LIST [socket.id].moveLeftInput = data.moveDirections[3];
    });
    socket.on ('sendAttackInput',function (data) { //This is to receive the data of the players attack choice input from the client
        PLAYER_LIST [socket.id].primaryAttack = data.primary,
        PLAYER_LIST [socket.id].secondaryAttack = data.secondary;
    });
    socket.on ('playerInitializationData', function (data) { //This is to recieve the misc. data of the players that doesn't fit anywhere above (I assume)
        PLAYER_LIST [socket.id].name = data.name;
    });
    socket.on('sendMousePosition', function (data) { //This is to recieve the data of the player's mouse positon.
        if (!PLAYER_LIST [socket.id].isDead){
            PLAYER_LIST [socket.id].mousePositionX = data.x;
            PLAYER_LIST [socket.id].mousePositionY = data.y;
        }
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
    var particleEffectDataPack = [];

    //This is called for every instance of player
    //Use it as gameplay update function for each player
    for (var i in PLAYER_LIST) {
        var player = PLAYER_LIST [i];

        if (!player.isDead && player.stunTimer <= 0 && player.spellTimer <= 0) {
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

            if (player.x_position > 950) {
                player.x_position = 950;
            } else if (player.x_position < 50) {
                player.x_position = 50;
            }

            if (player.y_position > 500) {
                player.y_position = 500;
            } else if (player.y_position < 80) {
                player.y_position = 80;
            }
        
        
            if (player.actionTimer <= 0) {
                if (player.primaryAttack) {
                    player.PrimaryAttackFunc ();
                }
                if (player.secondaryAttack) {
                    player.SecondaryAttackFunc ();
                }
            }

        }
        
        if (player.actionTimer > 0) {
            player.actionTimer--;
        }

        if (player.stunTimer > 0) {
            player.stunTimer--;
        }

        if (player.spellTimer > 0) {
            player.spellTimer--;
        }

        if (player.spell1.spellCooldown > 0) {
            player.spell1.spellCooldown--;
        }
        if (player.spell2.spellCooldown > 0) {
            player.spell2.spellCooldown--;
        }
        if (player.spell3.spellCooldown > 0) {
            player.spell3.spellCooldown--;
        }

        for (var i in player.perFrameEvent) {
            func = player.perFrameEvent [i];
            func (player);
        }

        var isFacingRight = player.mousePositionX - player.x_position >= 0;

        //This adds the new position data to the list
        playerDataPack.push ({
            x: player.x_position,
            y: player.y_position,
            name: player.name,
            team: player.team,
            kills:player.kills,
            maxHealth: player.maxHealth,
            currentHealth: player.currentHealth,
            id: player.id,
            isdead: player.isDead,
            isRight: isFacingRight,
            team1Score:team1Score, 
            team2Score:team2Score,
            cd1: player.spell1.spellCooldown,
            cd2: player.spell2.spellCooldown,
            cd3: player.spell3.spellCooldown,
            class: player.class
        });
        
    }

    for (var i in PARTICLE_EFFECT_LIST) {
        particle = PARTICLE_EFFECT_LIST [i];
        if (particle.owner == null || particle.age >= particle.lifetime)
            delete PARTICLE_EFFECT_LIST [i];
        else{
            particle.UpdateFunc ();
            particle.age++;
            particleEffectDataPack.push ({
                id: particle.id,
                x: particle.x_pos,
                y: particle.y_pos
            });
        }
    }

    for (var i in PROJECTILE_LIST) {
        var projectile = PROJECTILE_LIST [i];

        if (projectile.owner == null)
            delete PROJECTILE_LIST [i]
        else {
            //Projectile movement.
            projectile.x_position += projectile.x_velocity;
            projectile.y_position += projectile.y_velocity;
            
            //This checks for collision every frame with every player.
            for (var i in PLAYER_LIST) {
                var player = PLAYER_LIST [i];

                if (player != projectile.owner && !player.isDead) {
                    if (GetDistance(player.x_position ,player.y_position, projectile.x_position, projectile.y_position) <= projectile.radius + player.radius) {
                        projectile.OnCollision (player, i);
                    }
                }
            }

            //Projectile data to be sent to the client
            projectileDataPack.push ({
                x: projectile.x_position,
                y: projectile.y_position,
                id: projectile.id,
                rad: projectile.radius
            });


            if (projectile.age > projectile.lifetime) {
                projectile.DestroyThis (i);
            } else {
                projectile.age++;
            }   
        }
    }

    var dataPackage = {playerDataPack, projectileDataPack, particleEffectDataPack};

    //This is called for every socket (connection)
    //This sends data to the client
    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST [i];
        socket.emit ('sendPositionData', dataPackage); //Sending position data to all connections about every player's position
    }

    
}, 1000/25);