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
    // console.log(words);
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
            // console.log('l is defined');
            l.playerLeave(id);
            if (l.remainingGuessers() == 0) l.endRound();
            updateLobbyInfo(l);
        }
    });

    socket.on('createNewLobby', function(data) {
        var p = lobbies[0].idPlayer(socket.id);
        // console.log(p);
        if (p) {
            if (data.name.length < 30 && data.name.length > 0 && p) {
                if (!data.limit) data.limit = 999;
                var l = new Lobby(data.name, data.limit, data.password, socket.id);
                lobbies.push(l);
                joinCreatedLobby({
                    p: socket.id,
                    l: l.id,
                    leaving: lobbies[0].id
                });
                var json = {
                    name: l.name,
                    playerLimit: l.playerLimit,
                    playerCount: l.players.length,
                    passworded: l.passworded,
                    id: l.id
                }
                lobbies[0].sendToLobby('addLobbyToList', json);
                io.to(socket.id).emit('closePopups');
            } else pushAlert(socket.id, "Lobby name must be 1 character long and have less than 30 characters!", "#B71C1C");
        } else pushAlert(socket.id, "Something went wrong! Can't create a lobby for you!", "#B71C1C");
    });

    socket.on('undoDrawing', function(data) {
        var l = idLobby(data);
        // console.log('undoing drawing from '  + l.name)
        l.undoDrawing(socket.id);
    });

    socket.on('passwordAttempt', function(data) {
      console.log(data.l);
        var l = idLobby(data.l);
        console.log(l);
        if (l && l.password == data.password) {
            var p = lobbies[0].idPlayer(socket.id);
            if (p) {
                joinPasswordedLobby(l, p)
            } else pushAlert(socket.id, "Something went wrong trying to join the lobby!", "#B71C1C");
        } else pushAlert(socket.id, "Incorrect password!", "#B71C1C");
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
        joinLobbyAttempt(data);
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

function joinCreatedLobby(data) {
    var p = lobbies[0].idPlayer(data.p);
    var l = idLobby(data.l);
    if (p) {
        lobbies[0].playerLeave(p.id);
        addToLobby(l, p);
        updateLobbyInfo(l)
        updateLobbyInfo(lobbies[0]);
    } else {
        pushAlert(p.id, "Oops, something went wrong creating this lobby! Exit and try again.", "#B71C1C")
    }
}

function joinPasswordedLobby(l, p) {
    // var p = data.p;
    // var l = data.lobby
    if (p) {
        lobbies[0].playerLeave(p.id);
        addToLobby(l, p);
        updateLobbyInfo(l)
        updateLobbyInfo(lobbies[0]);
        io.to(p.id).emit('closePopups');
    } else {
        pushAlert(p.id, "Oops, something went wrong joining this lobby! Exit and try again.", "#B71C1C")
    }
}

function joinLobbyAttempt(data) {
    // console.log(data);
    var l = idLobby(data.l);
    // console.log(l.players);
    var leaving = idLobby(data.leaving);
    // console.log(leaving.players);
    if (l && l.players.length < l.playerLimit) {
        // console.log('joining lobby!')
        var p = leaving.idPlayer(data.p);
        // console.log('checking if P is a person');
        // console.log(p);
        if (p) {
            if (!l.passworded) {
                leaving.playerLeave(p.id);
                if (leaving.remainingGuessers() == 0 && !leaving.isMainLobby) leaving.endRound();
                addToLobby(l, p);
                updateLobbyInfo(l)
                updateLobbyInfo(leaving);
                // console.log(p.name + " leaving " + leaving.name + " to join " + l.name);
                // console.log(leaving.players);;
            } else {
                requestPassword(l, p);
                // r(p.id, "Lobby is passworded!", "#B71C1C");
            }
        } else {
            var p = playerFromSocket(data.p);
            var l = lobbyFromSocket(data.p);
            // console.log(l);
            // console.log(`somethings wrong with ` + p.name + ". removing from " + leaving.name + '.')
            l.playerLeave(p.id);
            if (l.remainingGuessers() == 0 && !l.isMainLobby) l.endRound();
            addToLobby(lobbies[0], p)
            pushAlert(p.id, 'Oops, something went wrong!<br>Returning you to the main lobby.', "#B71C1C");
            // updateLobbyInfo(l)
            updateLobbyInfo(l);
        }
    }
}

function pushAlert(id, msg, bg, fg) {
    var json = {
        msg: msg,
        bg: bg,
        fg: fg
    };
    io.to(id).emit('pushAlert', json);
}

function requestPassword(l, p) {
    var data = {
      popup: {
        title: {
            text: "Password!",
            properties: {
                color: 'white',
                'font-size': '36px'
            }
        },
        desc: {
            text: l.name + " wants a password!",
            properties: {
                color: 'rgba(200,200,200,1)',
                'font-size': '16px',
                'margin-bottom': '24px'
            }
        },
        "input-1": {
            label: {
                text: "Password:",
                properties: {
                    'color': 'white',
                    'margin-top': '8px',
                    'margin-bottom': '0px',
                    'font-size': '14px',
                    'margin-left': '5%'
                }
            },
            properties: {
                color: 'white',
                'background-color': '#212121',
                'width': '80%',
                'height': 'auto',
                'position': 'relative',
                'padding-left': '5%',
                'padding-right': '5%',
                'margin-bottom': '8px',
                'left': '5%'
            }
        },
        button: {
            text: "Join!",
            properties: {
                color: 'white',
                'background-color': 'rgba(0,60,0,.5)',
                // 'padding-left': '5%',
                'width': '90%',
                'height': 'auto',
                'position': 'relative',
                // 'padding-left': '10%',
                // 'padding-right': '10%',
                'left': '5%'
            }
        }

        // properties: = {
        //   // ''
        // }
    },
    l: l.id
  }

    io.to(p.id).emit('requestPassword', data);
}


function addToLobby(l, p) {
    // var player = p;
    // player.currentLobby = l;
    // console.log(p.id);
    var json = {
        name: l.name,
        id: l.id,
        players: l.players,
        currentWord: l.currentWord,
        currentDrawer: l.currentDrawer,
        currentDrawing: l.currentDrawing,
        isMainLobby: l.isMainLobby
    }
    if (json.currentWord) json.currentWord = l.currentWord.length;
    io.to(p.id).emit('joinLobby', json);
    if (l.isMainLobby) io.to(p.id).emit('allLobbyInfo', lobbyInfo());
    if (typeof(l) === "number") l = lobbyFromSocket(p.id);
    l.addPlayer(p);
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
    lobbies.forEach(function(l) {
        if (!l.isMainLobby) {
            checkTimer(l);
        }
    });
}


function checkTimer(l) {
    if (l.countTimer) {
        if (l.roundTimeLeft > 0 && l.players.length > 1) {
            l.roundTimeLeft--;
            // console.log('round proceeding, ' + roundTimeLeft + ' seconds left.\n');
            // console.log(l.roundTimeLeft);
            l.sendToLobby('updateTimer', l.roundTimeLeft + '');
            if (!l.hasDrawer()) {
              l.endRound();
            }
        } else if (l.players.length < 2) {
            // console.log('not enough players\n')
            l.sendServerMsg('Need more players!');
            l.roundCount = l.roundLimit;
            l.roundTimeLeft = 0;
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
            l.roundTimeLeft = 0;
            l.countTimer = false;
        }
    }
}

function lobbyResetGame(l) {
    l.sendChatMsg('Time out! The word was <span style="font-weight: bold">' + l.currentWord + '. </span>');
    l.sendAlert('Time out! The word was <span style="font-weight: bold">' + l.currentWord + "</span>.");
    l.roundCount = 0
    l.roundLimit = l.players.length * 2;
    l.clearScores();
    l.resetHasDrawn();
    l.sendServerMsg('Game over!')
    l.sendServerMsg('New game in 6 seconds.');
    setTimeout(lobbyNewRound, 1000, l);
}

function lobbyNewRound(l) {
    // var _this = this;
    // console.log(this);
    // console.log(_this);
    // console.log(l.roundCount);
    if (l.roundCount != 0) {
        // console.log(l.name + ' is not undefined');
        l.sendChatMsg('Time out! The word was <span style="font-weight: bold">' + l.currentWord + '. </span>');
        l.sendAlert('Time out! The word was <span style="font-weight: bold">' + l.currentWord + "</span>.")
    }
    l.currentWord = "[-=];=-;]=-]'-[';]-';]'";
    setTimeout(function() {
        if (l.players.length > 1) {
            l.clearDrawing();
            l.clearGuesses();
            l.currentDrawer = l.newDrawer();
            l.roundCount++;
            lobbyNewWord(l);
            l.firstGuess = true;
            l.countTimer = true;
            l.roundTimeLeft = 90;
        } else l.countTimer = true;
        // }
    }, 5000);

}

function updateLobbyInfo(l) {
    var json = {
        name: l.name,
        playerLimit: l.playerLimit,
        playerCount: l.players.length,
        passworded: l.passworded,
        id: l.id
    }
    lobbies[0].sendToLobby('updateLobbyInfo', json);
}

function lobbyNewWord(l) {
    l.currentWord = words[Math.floor(Math.random() * words.length)].toLowerCase();
    // console.log(l.currentWord);
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





setInterval(removeEmptyLobbies, 10000);

function removeEmptyLobbies() {
    lobbies.forEach(function(l, index) {
        if ((!l.isPersistent && !l.isMainLobby) &&
            l.players.length === 0) {
            var essentials = {
                name: l.name,
                playerLimit: l.playerLimit,
                playerCount: l.players.length,
                passworded: l.passworded,
                id: l.id
            }
            lobbies[0].sendToLobby('removeLobby', essentials);
            lobbies.splice(index, 1);
        }
    });
    // lobbies.push(new Lobby('hello!'));
}





function removeHTML(msg) {
    // var newmsg =
    return msg.replace(/<[^>]*>/g, "");
}
