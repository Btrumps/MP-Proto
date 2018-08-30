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
var PLAYER_LIST = {};

function Player(id) {
	this.x = 250;
	this.y = 250;
	this.id = id;
	this.number = "" + Math.floor(10 * Math.random());

	this.speed = 10;

	
	this.pressingRight = false;
	this.pressingLeft = false;
	this.pressingUp = false;
	this.pressingDown = false;

	this.move = function() {
		if (this.pressingUp) {
			this.y -= this.speed;
		}
		if (this.pressingDown) {
			this.y += this.speed;
		}
		if (this.pressingLeft) {
			this.x -= this.speed;
		}
		if (this.pressingRight) {
			this.x += this.speed;
		}		
	}
}

var clientNumber = 0;


var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket) {
	clientNumber++; // Increases number to make sure no two clients share same id
	socket.id = clientNumber;
	SOCKET_LIST[socket.id] = socket;

	// Creates a new player and adds it to our player list
	var newPlayer = new Player(socket.id);
	PLAYER_LIST[socket.id] = newPlayer;

	// This will remove the player from the socket/player list
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
	});

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
});

setInterval(function() {
	var pack = []; // Array which will contain all client's info
	for (var i in PLAYER_LIST) {
		var player = PLAYER_LIST[i];
		player.move();
		pack.push({
			x: player.x,
			y: player.y,
			number: player.number
		});
	}

	for (var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions', pack); // Passing in an array
	}

}, 1000/30);