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
var roundCount = 0;
var firstGuess = 0;
var roundLimit = 10;
var roundTimeLeft = -1;
var roundStartTime = new Date();
var countTimer = true;
// var hasGuessed = [];
// var roundTimeLimit;

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
    var connectData = {
        players: players,
        drawing: currentDrawing
    }


    io.to(socket.id).emit('connected', connectData);


    socket.on('joinAttempt', function(data) {
        if (data.length < 30) {
            var newName = data.replace(/<[^>]*>/g, "");
            io.to(socket.id).emit('joinGame', newName);
        } else io.to(socket.id).emit('joinFailed');
    });

    socket.on('addPlayer', function(data) {
        data.name = data.name.replace(/<[^>]*>/g, "");
        players.push(data);
        socket.broadcast.emit('addPlayer', data);
    });

    socket.on('disconnect', function() {
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            if (p.id === socket.id) {
                io.emit('removePlayer', socket.id);
                sendAlert(p.name + " has left.");
                players.splice(i, 1);
            }
        }
    });

    socket.on('undoDrawing', function() {
        var p = idPlayer(socket.id);
        if (p.isDrawing && currentDrawing.length > 0) {
            undoDrawing();
            io.emit('undoDrawing');
        }
    })

    socket.on('addToDrawing', function(data) {
        var player = idPlayer(socket.id);
        if (player.isDrawing) {
            socket.broadcast.emit('addToDrawing', data);
            currentDrawing.push(data);
        }
    })

    socket.on('chatMsg', function(data) {
        var guessedString = data.toLowerCase();
        var guessedWord = (guessedString.indexOf(currentWord) !== -1);
        var guesser = idPlayer(socket.id);
        if (guessedWord && (typeof currentDrawer !== 'undefined') && (currentDrawer.id != socket.id) && (!guesser.correctlyGuessed)) {
            guesser.score += roundTimeLeft;
            guesser.correctlyGuessed = true;
            io.emit('updateScoreboard', guesser);

            io.to(socket.id).emit('correctGuess', currentWord);
            // io.emit('updateScoreboard', json);
            if (firstGuess) {
              if (players.length > 2){
                currentDrawer.score += roundTimeLeft;
                sendServerMsg(' has guessed correctly, earning ' + roundTimeLeft + ' points for himself and the drawer!', guesser);
                io.emit('updateScoreboard', currentDrawer);
              } else sendServerMsg(' has guessed correctly, earning ' + roundTimeLeft + ' points!', guesser);
                roundTimeLeft = Math.floor(roundTimeLeft * (4/6));
                firstGuess = false;
            }
            if (remainingGuessers() == 0) endRound();

        }

        if (data.length < 301 && !guessedWord) {
            var p;
            players.forEach(function(e) {
                if (e.id === socket.id) p = e;
            });
            if (p != "undefined") {
                sendChatMsg(": " + data, p);
            }
        }
        if (data.length > 300) io.to(socket.id).emit('chatTooLong');
    })



});

function undoDrawing() {
    for (var i = currentDrawing.length - 1; i >= 0; i--) {
        if (currentDrawing[i].begin) {
            console.log(i);
            for (var j = currentDrawing.length - 1; j >= i; j--) {
                currentDrawing.splice(j, 1);
            }
            console.log('undoing drawing...');
            break;
        }
    }
}

function newDrawer() {
    var drawers = getHasntDrawn();
    var rand = Math.random() * drawers.length;
    var num = Math.floor(rand);
    var p = drawers[num];
    p.isDrawing = true;
    p.hasDrawn = true;
    io.emit('isDrawing', p);
    sendServerMsg(' is drawing!', p);
    return p;

}

function getHasntDrawn(){
  var poolOfDrawers = [];
  players.forEach(function(e){
    if (e.hasDrawn == false) poolOfDrawers.push(e);
  });
  if (poolOfDrawers.length === 0){
    resetHasDrawn();
    poolOfDrawers = players;
  }
  return poolOfDrawers;
}


function resetHasDrawn() {
    players.forEach(function(e) {
        e.hasDrawn = false;
    })
}


function remainingGuessers() {
    var remainingGuessers = 0;
    players.forEach(function(e) {
        if (e.correctlyGuessed === false && !e.isDrawing) {
            remainingGuessers++;

        }
    })
    return remainingGuessers;
}

function clearGuesses() {
    players.forEach(function(e) {
        e.correctlyGuessed = false;
    })
}

function newWord() {
    currentWord = words[Math.floor(Math.random() * words.length)].toLowerCase();
    console.log(currentWord);
    var json = {
        word: currentWord,
        count: roundCount
    }
    io.to(currentDrawer.id).emit('drawerWord', json);
    players.forEach(function(p) {
        if (p != currentDrawer) {
            var json = {
                length: currentWord.length,
                count: roundCount
            }
            io.to(p.id).emit('guesserWord', json);
        }
    })
}


function newRound() {
    if (roundCount != 0) {
        sendChatMsg('Time out! The word was <span style="font-weight: bold">' + currentWord + '. </span>');
        sendAlert('Time out! The word was <span style="font-weight: bold">' + currentWord + "</span>.")
    }
    currentWord = "[-=];=-;]=-]'-[';]-';]'";
    setTimeout(function() {
        // if (players.length > 1) {
        clearDrawing();
        clearGuesses();
        currentDrawer = newDrawer();
        roundCount++;
        newWord();
        firstGuess = true;
        countTimer = true;
        roundTimeLeft = 90;
        // }
    }, 5000);

}

function clearScores(){
  players.forEach(function(e){
    e.score = 0;
  });
}


function sendAlert(msg, bg, fg) {
    data = {
        msg: msg,
        bg: bg,
        fg: fg
    }
    io.emit('pushAlert', data);
}

function endRound() {
    roundTimeLeft = -1;
}

function checkTimer() {
    if (countTimer) {
        if (roundTimeLeft > 0 && players.length > 1) {
            roundTimeLeft--;
            // console.log('round proceeding, ' + roundTimeLeft + ' seconds left.\n');
            io.emit('updateTimer', roundTimeLeft);
        } else if (players.length < 2) {
            console.log('not enough players\n')
            sendServerMsg('Need more players!');
            roundTimeLeft = -1;
            roundCount = 10;
        } else if (roundTimeLeft < 1 && roundCount >= roundLimit) {
            resetGame();
            // clearDrawing();
            countTimer = false;
            console.log('game over, restarting')
        } else if (roundTimeLeft < 1) {
            console.log('round over, new round starting.')
            newRound();
            countTimer = false;
        }
    }
}

setInterval(checkTimer, 1000);

function resetGame() {
    roundCount = 0
    roundLimit = players.length * 3;
    clearScores();
    resetHasDrawn();
    sendServerMsg('Game over!')
    sendServerMsg('New game in 10 seconds.');
    setTimeout(newRound, 5000);
}


function idPlayer(playerID) {
    for (var i = 0; i < players.length; i++) {
        if (playerID === players[i].id) {
            return players[i];
        }
    }
}

function clearDrawing() {
    io.emit('clearDrawing');
    currentDrawing = [];
    players.forEach(function(e) {
        e.isDrawing = false;
    })
}


function removeHTML(msg) {
    // var newmsg =
    return msg.replace(/<[^>]*>/g, "");
}

function sendServerMsg(msg, player) {
    if (typeof player === 'object') {
        var message = `<span class="chatName" style="color: rgba(200,200,255,1); font-weight: bold;">` + player.name + `</span> <span style="color: rgba(150,150,255,1)">` + msg + "</span><BR><BR>";
    } else var message = '<span style="color: rgba(200,200,255,1);">' + msg + "</span><BR><BR>";
    chat += message;
    io.emit("updateChat", message);
}

function sendChatMsg(msg, player) {
    if (typeof player === 'object') {
        var newMsg = removeHTML(msg);
        var message = "<span class='chatName'>" + player.name + "</span>" + newMsg + "<BR><BR>";
    } else var message = msg + "<BR><BR>";
    chat += message;
    io.emit("updateChat", message);
}
