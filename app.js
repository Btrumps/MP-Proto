var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req,res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server Started.");

var SOCKET_LIST = {};

function Entity() {
	this.x = 250;
	this.y = 250;
	this.velX = 0;
	this.velY = 0;
	this.id = "";

	this.move = function() {
		this.updatePosition();
	}

	this.updatePosition = function() {
		this.x += this.velX;
		this.y += this.velY;
	}
}

function Player(id) {
	Entity.call(this);
	this.id = id;
	this.number = "" + Math.floor(10 * Math.random());
	this.speed = 10;
	
	this.pressingRight = false;
	this.pressingLeft = false;
	this.pressingUp = false;
	this.pressingDown = false;

	this.entityMove = this.move;
	this.move = function() {
		this.updateVelocity();
		this.entityMove();
	}

	this.updateVelocity = function() {
		if (this.pressingUp) {
			this.velY = -this.speed;
		} else if (this.pressingDown) {
			this.velY = this.speed;
		} else {
			this.velY = 0;
		}

		if (this.pressingLeft) {
			this.velX = -this.speed;
		} else if (this.pressingRight) {
			this.velX = this.speed;
		} else {
			this.velX = 0;
		}
	}
	// Adds this client to the player list whenever the client is created
	Player.list[id] = this;
}
Player.prototype = Object.create(Entity.prototype);

Player.list = {}; // This creates a static list/array, specific to Players

Player.onConnect = function(socket) {
	var newPlayer = new Player(socket.id);

	socket.on('keyPress', function(data) {
		if (data.inputId === 'up') {
			newPlayer.pressingUp = data.state;
		} else if (data.inputId === 'down') {
			newPlayer.pressingDown = data.state;
		} else if (data.inputId === 'left') {
			newPlayer.pressingLeft = data.state;
		} else if (data.inputId === 'right') {
			newPlayer.pressingRight = data.state;
		}
	});
}

Player.onDisconnect = function(socket) {
	delete Player.list[socket.id];
}

Player.update = function() {
	var pack = []; // Array which will contain all client's info
	for (var i in Player.list) {
		var player = Player.list[i];
		player.move();
		pack.push({
			x: player.x,
			y: player.y,
			number: player.number
		});
	}

	return pack;
}

function Bullet(angle, id) {
	Entity.call(this);

	this.id = id;
	this.velX = Math.cos(angle/180 * Math.PI) * 1;
	this.velY = Math.sin(angle/180 * Math.PI) * 1;

	this.timer = 0;
	this.toRemove = false;

	entityMove = this.move;
	this.move = function() {
		if (this.timer > 100) {
			this.toRemove = true;
		} else {
			this.timer++;
			entityMove();
		}
		
	}
	Bullet.list[id] = this;
}
Bullet.prototype = Object.create(Entity.prototype);

Bullet.list = {};

var bulletIdCounter = 0;
Bullet.update = function() {
	if (Math.random() < 0.1) {
		bulletIdCounter++;
		Bullet(Math.random() * 360, bulletIdCounter); // create a bullet going in a random direction
	}

	var pack = []; // Array which will contain all client's bullet info
	for (var i in Bullet.list) {
		var bullet = Bullet.list[i];
		bullet.move();
		pack.push({
			x: bullet.x,
			y: bullet.y
		});
	}

	return pack;
}

var clientNumber = 0;
var io = require('socket.io')(serv,{});
////////////////////////////////////////////////////////////////
//////// WHEN A CLIENT CONNECTS, THIS FUNCTION IS CALLED ///////
////////////////////////////////////////////////////////////////
io.sockets.on('connection', function(socket) {
	clientNumber++; // Increases number to make sure no two clients share same id
	socket.id = clientNumber;
	SOCKET_LIST[socket.id] = socket;	

	Player.onConnect(socket);

	// This will remove the player from the socket/player list
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
});

setInterval(function() {
	var pack = {
		player: Player.update(),
		bullet: Bullet.update()
	}

	for (var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions', pack); // Passing in an array
	}

}, 1000/30);