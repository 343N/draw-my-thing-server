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
        // console.log(data);
        if (data.length < 3000) {
            // console.log(data + ' is joining..')
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
            if (players[i].id === socket.id) {
                io.emit('removePlayer', socket.id);
                sendAlert(players[i].name + " has left.");
                players.splice(i, 1);
            }
        }
    });

    socket.on('undoDrawing', function() {
        var p = idPlayer(socket.id);
        // console.log(p);
        // console.log(p.isDrawing);
        if (p.isDrawing && currentDrawing.length > 0) {
            undoDrawing();
            io.emit('undoDrawing');
        }
    })

    socket.on('addToDrawing', function(data) {
        // console.log(data);
        var player = idPlayer(socket.id);
        // console.log(player.isDrawing + " :server \n" + data.player.isDrawing + " :client");
        if (player.isDrawing) {
            socket.broadcast.emit('addToDrawing', data);
            currentDrawing.push(data);
        }
        // else console.log("Drawing by " + data.player.name + " denied!")
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
            console.log(remainingGuessers());
            sendServerMsg(' has guessed correctly, earning ' + roundTimeLeft + ' points!', guesser);
            if (remainingGuessers() == 0) endRound();
            if (firstGuess) {
                roundTimeLeft = Math.floor(roundTimeLeft / 2);
                firstGuess = false;
            }
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
    console.log(currentDrawing.length);
    for (var i = currentDrawing.length - 1; i >= 0; i--) {
      // console.log('looking for beginning at latest ' + i);
        if (currentDrawing[i].begin) {
            console.log(i);
            // console.log(j);
            for (var j = currentDrawing.length - 1; j >= i; j--) {
                currentDrawing.splice(j, 1);
            }
            break;

        }
    }
}

function newDrawer() {
    if (players.length > 0) {
        var rand = Math.random() * players.length;
        var num = Math.floor(rand);
        console.log(num);
        console.log(rand);
        players[num].isDrawing = true;
        io.emit('isDrawing', players[num]);
        sendServerMsg(' is drawing!', players[num]);
        return players[num];
    }
}



function remainingGuessers() {
    var remainingGuessers = 0;
    players.forEach(function(e) {
        if (e.correctlyGuessed === false && !e.isDrawing) {
            remainingGuessers++;
            console.log(e.name);
            console.log(e.id);

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
    // console.log(words.length);
    io.to(currentDrawer.id).emit('drawerWord', currentWord);
    players.forEach(function(p) {
        if (p != currentDrawer) {
            io.to(p.id).emit('guesserWord', currentWord.length);
        }
    })
}


function newRound() {
    if (roundCount != 0) {
        sendChatMsg('Time out! The word was <span style="font-weight: bold">' + currentWord+ '. </span>');
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
        // startTime = new Date();
        // console.log(currentWord);
        // sendChatMsg()
        // }
    }, 5000);

}

function sendAlert(msg, bg, fg){
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
    // console.log('checking timer.')
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
            // countTimer = true;
            // resetGame();
            // newRound();
        } else if (roundTimeLeft < 1 && roundCount >= roundLimit) {
            resetGame();
            countTimer = false;
            console.log('game over, restarting.\n')
        } else if (roundTimeLeft < 1) {
            console.log('round over, new round starting.\n')
            newRound();
            countTimer = false;
        }
    }
}

setInterval(checkTimer, 1000);

function resetGame() {
    roundCount = 0
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
    // console.log(message);
    chat += message;
    io.emit("updateChat", message);
}

function sendChatMsg(msg, player) {
    // console.log(msg);
    if (typeof player === 'object') {
        var newMsg = removeHTML(msg);
        var message = "<span class='chatName'>" + player.name + "</span>" + newMsg + "<BR><BR>";
    } else var message = msg + "<BR><BR>";
    // console.log(message);
    chat += message;
    io.emit("updateChat", message);
}
