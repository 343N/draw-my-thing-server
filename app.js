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
eval(fs.readFileSync(__dirname + '/lobby.js') + '');
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
        if (p.name.length < 30 && p.name.length > 0) {
            p.name = p.name.replace(/<[^>]*>/g, "");
            io.to(socket.id).emit('givePlayer', p);
            addToLobby(lobbies[0], p)


        }

        if (data.name.length > 29) {
            io.to(socket.id).emit('joinFailed', "Name must be less than 30 characters long!");
        } else if (data.name.split('').length < 1) {
            io.to(socket.id).emit('joinFailed', "Name must have at least one character!");
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
        console.log('undoing drawing from '  + l.name)
        l.undoDrawing(socket.id);
    })


    socket.on('addToDrawing', function(data) {
        var l = idLobby(data.lobby);
        l.addToDrawing(socket.id, data);
    });



    socket.on('chatMsg', function(data) {
        var l = idLobby(data.lobby);
        var json = {
            msg: data.msg,
            id: socket.id
        }
        l.receiveChatMsg(data)


    });

    socket.on('joinLobbyAttempt', function(data) {
        var l = idLobby(data.l);
        var leaving = idLobby(data.leaving);
        if (!l.passworded && l.players.length < l.playerLimit) {
            var p = leaving.idPlayer(data.p);
            if (p) {
                leaving.playerLeave(p.id);
                console.log(l.name + " " + p);
                addToLobby(l, p);
            } else {
                var p = playerFromSocket(data.p);
                var l = lobbyFromSocket(data.p);
                console.log(`somethings wrong with ` + p.name + ". removing from " + l.name + '.')
                l.playerLeave(p.id);
                addToLobby(lobbies[0], p)
                pushAlert(p.id, 'Oops, something went wrong!<br>Returning you to the main lobby.', "#B71C1C");
            }
        }
    });

    // socket.on('sendLobby', function(l){
    //   io.to(socket.id).emit('receiveData', lobbies);
    // })
});

lobbies.push(new Lobby('The General Lobby'))
lobbies[0].isMainLobby = true;
lobbies[0].id = 0;
lobbies.push(new Lobby('Main Lobby 1'))
lobbies[1].isPersistent = true;
lobbies[1].id = 1;
lobbies.push(new Lobby('Main Lobby 2'))
lobbies[2].isPersistent = true;
lobbies[2].id = 2;
lobbies.push(new Lobby('Main Lobby 3'))
lobbies[3].isPersistent = true;
lobbies[3].id = 3;

// lobbies[0].name = "The General Lobby";

function pushAlert(id, msg, bg, fg) {
    var json = {
        msg: msg,
        bg: bg,
        fg: fg
    };
    io.to(id).emit('pushAlert', json);
}

function addToLobby(l, p) {
    // var player = p;
    // player.currentLobby = l;
    // console.log(p.id);
    io.to(p.id).emit('joinLobby', l);
    if (l.isMainLobby) io.to(p.id).emit('allLobbyInfo', lobbyInfo());
    if (typeof(l) === "number") l = lobbyFromSocket(p.id);
    l.addPlayer(p);
    console.log(l.name + ' is a main lobby? ' + l.isMainLobby);
    console.log(p.name + " has joined " + l.name);
    // console.log(l);
    // console.
    // console.log("LOBBYFROMSOCKET");
    // console.log(ass + ' from ' + p.name + ' - ' + p.id);
    // console.log('LOBBYFROMSOCKET');
}

function idLobby(id) {
    var l;
    lobbies.forEach(function(e) {
        // console.log(typeof(id));
        // console.log(e.id);
        if (typeof(id) == 'number')
            // console.log(dicks);
            if (id === e.id) l = e;
        if (typeof(id) == 'object')
            if (id.id === e.id) l = e;
    });
    // console.log(l);
    return l;
}

setInterval(timerAllLobbies, 1000);

function timerAllLobbies() {
    lobbies.forEach(function(l){
      if (!l.isMainLobby){
        checkTimer(l);
      }
    });
}


function checkTimer(l){
  if (l.countTimer) {
      if (l.roundTimeLeft > 0 && l.players.length > 1) {
          l.roundTimeLeft--;
          // console.log('round proceeding, ' + roundTimeLeft + ' seconds left.\n');
          l.sendToLobby('updateTimer', l.roundTimeLeft);
      } else if (l.players.length < 2) {
          // console.log('not enough players\n')
          l.sendServerMsg('Need more players!');
          // l.roundTimeLeft = 5;
          // l.roundCount = 10;
          // lobbyResetGame(l);
      } else if (l.roundTimeLeft < 1 && l.roundCount >= l.roundLimit) {
          lobbyResetGame(l);
          // clearDrawing();
          l.countTimer = false;
          // console.log('game over, restarting')
      } else if (l.roundTimeLeft < 1) {
          // console.log('round over, new round starting.')
          lobbyNewRound(l);
          l.countTimer = false;
      }
  }
}

function lobbyResetGame(l){
  l.roundCount = 0
  l.roundLimit = l.players.length;
  l.clearScores();
  l.resetHasDrawn();
  l.sendServerMsg('Game over!')
  l.sendServerMsg('New game in 6 seconds.');
  setTimeout(lobbyNewRound, 1000, l);
}

function lobbyNewRound(l){
  // var _this = this;
  // console.log(this);
  // console.log(_this);
  console.log(l.roundCount);
  if (l.roundCount != 0) {
    console.log(l.name + ' is not undefined');
      l.sendChatMsg('Time out! The word was <span style="font-weight: bold">' + l.currentWord + '. </span>');
      l.sendAlert('Time out! The word was <span style="font-weight: bold">' + l.currentWord + "</span>.")
  }
  l.currentWord = "[-=];=-;]=-]'-[';]-';]'";
  setTimeout(function() {
      // if (players.length > 1) {
      l.clearDrawing();
      l.clearGuesses();
      l.currentDrawer = l.newDrawer();
      l.roundCount++;
      lobbyNewWord(l);
      l.firstGuess = true;
      l.countTimer = true;
      l.roundTimeLeft = 90;
      // }
  }, 5000);

}

function lobbyNewWord(l) {
    l.currentWord = words[Math.floor(Math.random() * words.length)].toLowerCase();
    console.log(l.currentWord);
    var json = {
        word: l.currentWord,
        count: l.roundCount
    }
    io.to(l.currentDrawer.id).emit('drawerWord', json);
    l.players.forEach(function(p) {
        if (p != l.currentDrawer) {
            var json = {
                length: l.currentWord.length,
                count: l.roundCount
            }
            io.to(p.id).emit('guesserWord', json);
        }
    })
}

function lobbyFromSocket(id) {
    var lobby;
    lobbies.forEach(function(e) {
        // console.log(e.name + ' @ lobbyFromSocket');
        // console.log(e.players);
        e.players.forEach(function(p) {
            // console.log('does ' + p.id + ' match ' + id);
            if (id === p.id) {
                // console.log('yes it does');
                lobby = e;
            }
            //else console.log(`no it doesnt`);
            // });
        });
    });
    return lobby;
}

function playerFromSocket(id) {
    var player;
    lobbies.forEach(function(e) {
        // console.log(e.name + ' @ lobbyFromSocket');
        // console.log(e.players);
        e.players.forEach(function(p) {
            // console.log('does ' + p.id + ' match ' + id);
            if (id === p.id) {
                // console.log('yes it does');
                player = p;
            }
            // else console.log(`no it doesnt`);
        });
    });
    return player;
}




function lobbyInfo() {
    var lobbyArray = [];
    lobbies.forEach(function(e, i) {
        if (!e.isMainLobby) {
            var essentials = {
                name: e.name,
                playerLimit: e.playerLimit,
                playerCount: e.players.length,
                passworded: e.passworded,
                id: e.id
            }
            lobbyArray.push(essentials);
        }
    });

    return lobbyArray;
}





setInterval(removeEmptyLobbies, 5000);

function removeEmptyLobbies() {
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
