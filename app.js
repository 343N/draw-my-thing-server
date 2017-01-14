var express = require('express');
var socket = require('socket.io');
var https = require('https');
var fs = require('fs');
var players = [];
var chat;
var currentDrawing = [];
var currentDrawer;
var words = [];
var currentWord;
// var roundCount = 0;
// var firstGuess = 0;
// var roundLimit = 10;
// var roundTimeLeft = -1;
// var countTimer = true;
var roundStartTime = new Date();
var lobbies = [];
// var hasGuessed = [];
// var roundTimeLimit;
eval(fs.readFileSync(__dirname +'/lobby.js') + '');
//
var app = express();
var server = app.listen(9876);

var io = socket(server);

fs.readFile('data.txt', 'utf8', function(err, data) {
    words = data.split(/\r?\n/);
    words.splice(words.length - 1, 1);
    console.log(words);
})

currentWord = words[Math.floor(Math.random() * words.length)];



app.use(express.static(__dirname + "/../draw-my-thing-remake/"));
console.log(__dirname);
io.sockets.on('connection', function(socket) {
    // socket.on('requestData', function(){
    //   io.to(socket.id).emit('requestData', connectData);
    // });
    io.to(socket.id).emit('connected');
    // io.to(socket.id).emit('joinLobby', lobbies[0]);


    socket.on('joinServerAttempt', function(data) {
        var p = data;
        if (p.name.length < 30) {
            p.name = p.name.replace(/<[^>]*>/g, "");
            io.to(socket.id).emit('givePlayer', p);
            addToLobby(lobbies[0], p)

        }

        if (data.name.length > 29) {
            io.to(socket.id).emit('connectFailed', "Name must be less than 30 characters long!");
        } else if (data.name.length < 1) {
            io.to(socket.id).emit('connectFailed', "Name must have at least one character!");
        }
    });

    // socket.on('addPlayer', function(data) {
    //
    //     data.name = data.name.replace(/<[^>]*>/g, "");
    //     players.push(data);
    //     sendToLobbyExcept(socket.id, 'addPlayer', data);
    // });

    socket.on('disconnect', function() {
        var id = socket.id;
        var l = lobbyFromSocket(id);
        // console.log(l + "\n DISCONNECT");
        if (l) {
          console.log('l is defined');
          l.playerLeave(id);
        }
    });

    socket.on('undoDrawing', function(data) {
        var l = idLobby(data);
        l.undoDrawing(socket.id);
    })


    socket.on('addToDrawing', function(data) {
        var l = idLobby(data.lobby);
        l.addToDrawing(socket.id)
    });



    socket.on('chatMsg', function(data) {
        var l = idLobby(data.lobby);
        var json = {
            msg: data.msg,
            id: socket.id
        }
        l.receiveChatMsg(data)


    });

    socket.on('sendLobby', function(l){
      io.to(socket.id).emit('receiveData', lobbies);
    })
});

lobbies.push(new Lobby('The General Lobby'))
lobbies[0].isMainLobby = true;
// lobbies[0].name = "The General Lobby";

function addToLobby(l, p) {
    var player = p;
    // player.currentLobby = l;
    // console.log(p.id);
    io.to(player.id).emit('joinLobby', l);
    console.log(p.name + " has joined " + l.name);
    var ass = lobbyFromSocket(p.id);
    console.log(l);
    l.addPlayer(player);
    // console.
    // console.log("LOBBYFROMSOCKET");
    // console.log(ass + ' from ' + p.name + ' - ' + p.id);
    // console.log('LOBBYFROMSOCKET');
}

function idLobby(id) {
    lobbies.forEach(function(e) {
        if (typeof(id) == 'string')
            if (id === e.id) return e;
        if (typeof(id) == 'object')
            if (id.id === e.id) return e;
    });
}

function lobbyFromSocket(id) {
    var lobby;
    lobbies.forEach(function(e) {
        // console.log(e.name + ' @ lobbyFromSocket');
        // console.log(e.players);
        e.players.forEach(function(p) {
            console.log('does '+p.id + ' match ' + id);
            if (id === p.id) {
              console.log('yes it does');
              lobby = e;
            } else console.log(`no it doesnt`);
        });
    });
    return lobby;
}






setInterval(checkLobbies, 5000);

function checkLobbies() {
    lobbies.forEach(function(l, index) {
        if ((!l.isPersistent && !l.isMainLobby) &&
            l.players.length === 0) {
            lobbies[0].sendToLobby('removeLobby', l.id);
            lobbies.splice(index, 1);
        }
    });
}





function removeHTML(msg) {
    // var newmsg =
    return msg.replace(/<[^>]*>/g, "");
}
