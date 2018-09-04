var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req,res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server Started.");


var sql = require('mssql');

var config = {
        user: 'sa',
        password: 'omgstop92',
        server: 'localhost', 
        database: 'myGame',
        options: {
        instanceName: 'BrandonSQL',
        encrypt : true
    }
};

var notConnected = true;

sql.connect(config, function(err) {
	if (err) console.log (err);
	console.log ('connected to sql server');
	notConnected = false;
});

function sqlQuery(dbQuery, cb) {
	var request = new sql.Request();

	//query
	request.query(dbQuery, function(err, result) {
		if (err) console.log('dbQuery: ' + err);
		console.log('callback running');
		cb(result.recordset);
	});
}

// queryResult = sqlQuery('some query');

var SOCKET_LIST = {};
var DEBUG = true;

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

var bulletIdCounter = 0;

function Bullet(angle) {
	Entity.call(this);

	this.id = bulletIdCounter;
	this.velX = Math.cos(angle/180 * Math.PI) * 5;
	this.velY = Math.sin(angle/180 * Math.PI) * 5;

	this.timer = 0;

	this.entityMove = this.move;
	this.move = function() {
		if (this.timer > 180) {
			delete Bullet.list[this.id];
		} else {
			this.timer++;
			this.entityMove();
		}
	}
	Bullet.list[this.id] = this;
}
Bullet.prototype = Object.create(Entity.prototype);

Bullet.list = {};

Bullet.update = function() {
	if (Math.random() < 0.1) {
		bulletIdCounter++;
		var newBullet = new Bullet(Math.random() * 360);
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

// List of users and passwords. Right now, this will clear every time the server restarts
// This is because we don't have a database yet.
var USERS = {
	// username : password
	"bob":"asd",
	"brandon":"password",
	"admin":"password",
}

// Callback == the function passed in. It will not run until setTimeout is finished
// We use Set Timeout to emulate a server connecting to a database
var isValidPassword = function(data, callback) {
	setTimeout(function() {
		callback(USERS[data.username] === data.password);
	}, 10);
}

var isUsernameTaken = function(data, callback) {
	setTimeout(function() {
		callback(USERS[data.username]);
	}, 10);
}

var addUser = function(data, callback) {
	setTimeout(function() {
		USERS[data.username] = data.password;
		callback(); // This is used if the function passed in doesn't return anything 
	}, 10);
}

var queryResult;
var clientNumber = 0;
var io = require('socket.io')(serv,{});
////////////////////////////////////////////////////////////////
//////// WHEN A CLIENT CONNECTS, THIS FUNCTION IS CALLED ///////
////////////////////////////////////////////////////////////////
io.sockets.on('connection', function(socket) {
	clientNumber++; // Increases number to make sure no two clients share same id
	socket.id = clientNumber;
	SOCKET_LIST[socket.id] = socket;

	console.log('socket connection from ' + socket.id);

	sqlQuery("SELECT * FROM tblUsers WHERE username = 'brandon';", function(res) {
		console.log(res);
		queryResult = res;
	});

	socket.on('signIn', function(data) {
		if (isValidPassword(data, function(result) {
			if (result) {
				Player.onConnect(socket);
				socket.emit('signInResponse', {success: true});
			} else {
				socket.emit('signInResponse', {success: false});
			}
		}));
	});

	socket.on('signUp', function(data) {
		if (isUsernameTaken(data, function(result) {
			 if (result) {
				socket.emit('signUpResponse', {success: false});
			} else {
				addUser(data, function() {
					socket.emit('signUpResponse', {success: true});
				});
			}
		}));
	});

	// This will remove the client from the socket/player list
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});

	// When a client submits a message on the chatForm, the server sends the message to all clients
	socket.on('sendMsgToServer', function(data) {
		var playerName = "Player" + socket.id;

		for (var i in SOCKET_LIST) {
			SOCKET_LIST[i].emit('addToChat', playerName + ': ' + data);
		}
	});

	// This message allows the client to check values on the servers end
	socket.on('evalServer', function(data) {
		if (DEBUG) {
			var answer = eval(data);
			socket.emit('evalAnswer', answer);
		} else {
			socket.emit('evalAnswer', "Error : Can't process that information, not in debug mode");
		}
	});
});

// Main game loop
setInterval(function() {
	var pack = {
		player: Player.update(), // Loops through all players, runs their move() function and updates positions
		bullet: Bullet.update(), // Loops through all bullets, runs their move() function and updates positions
	}

	for (var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions', pack); // Passing in an array
	}

}, 1000/30);