var Lobby = function(name, playerLimit, password) {
    self = this;
    self.name = name;
    self.id = Date.now();
    self.playerLimit = playerLimit || 999;
    self.password = password || "";
    self.passworded = (self.password.length > 0);
    self.isMainLobby = false;
    self.isPersistent = false;

    self.currentDrawing = [];
    self.players = [];
    self.currentDrawer;
    self.currentWord;
    self.roundCount = 0;
    self.firstGuess = 0;
    self.roundLimit = 10;
    self.roundTimeLeft = -1;
    self.countTimer = true;
    self.chat = '';
}

Lobby.prototype = {
    undoDrawing: function(p) {
            var p = self.idPlayer(p);
            if (p.isDrawing && self.currentDrawing.length > 0) {
                for (var i = self.currentDrawing.length - 1; i >= 0; i--) {
                    if (self.currentDrawing[i].begin) {
                        console.log(i);
                        for (var j = self.currentDrawing.length - 1; j >= i; j--) {
                            self.currentDrawing.splice(j, 1);
                        }
                        console.log('undoing drawing..');
                        self.sendToLobby('undoDrawing');
                        break;
                    }
                }
            }
        },

        addToDrawing: function(p) {
            var player = idPlayer(p);
            if (player.isDrawing) {
                self.sendToLobby('addToDrawing', data);
                currentDrawing.push(data);
            }
        },


        resetGame: function() {
            self.roundCount = 0
            self.roundLimit = self.players.length * 3;
            self.clearScores();
            self.resetHasDrawn();
            self.sendServerMsg('Game over!')
            self.sendServerMsg('New game in 10 seconds.');
            setTimeout(self.newRound, 5000);
        },

        newDrawer: function() {
            var drawers = self.getHasntDrawn();
            var rand = Math.random() * drawers.length;
            var num = Math.floor(rand);
            var p = drawers[num];
            p.isDrawing = true;
            p.hasDrawn = true;
            self.sendToLobby('isDrawing', p);
            self.sendServerMsg(' is drawing!', p);
            return p;

        },

        getHasntDrawn: function() {
            var poolOfDrawers = [];
            self.players.forEach(function(e) {
                if (e.hasDrawn == false) poolOfDrawers.push(e);
            });
            if (poolOfDrawers.length === 0) {
                self.resetHasDrawn();
                poolOfDrawers = players;
            }
            return poolOfDrawers;
        },

        clearDrawing: function() {
            self.sendToLobby('clearDrawing');
            self.currentDrawing = [];
            self.players.forEach(function(e) {
                e.isDrawing = false;
            })
        },

        sendServerMsg: function(msg, player) {
            if (typeof player === 'object') {
                var message = `<span class="chatName" style="color: rgba(200,200,255,1); font-weight: bold;">` + player.name + `</span> <span style="color: rgba(150,150,255,1)">` + msg + "</span><BR><BR>";
            } else var message = '<span style="color: rgba(200,200,255,1);">' + msg + "</span><BR><BR>";
            self.chat += message;
            self.sendToLobby("updateChat", message);
        },

        playerLeave: function(p) {
            self.players.forEach(function(e, i) {
                if (e.id === p) {
                    self.sendToLobby('removePlayer', e.id);
                    self.sendAlert(`<span style="font-weight: bold">` + e.name + "</span> has left.");
                    self.players.splice(i, 1);
                }
            });
        },

        // self.playerJoin(p){
        // }



        sendToLobby: function(message, data) {
            if (data) {
                self.players.forEach(function(e) {
                    io.to(e.id).emit(message, data)
                })
            } else {
                self.players.forEach(function(e) {
                    io.to(e.id).emit(message)
                })
            }
        },

        sendToLobbyExcept: function(id, message, data) {
            if (data) {
                self.players.forEach(function(e) {
                    if (id !== e.id) io.to(e.id).emit(message, data);
                })
            } else {
                self.players.forEach(function(e) {
                    if (id !== e.id) io.to(e.id).emit(message);
                })
            }
        },

        sendChatMsg: function(msg, player) {
            if (typeof player === 'object') {
                var newMsg = removeHTML(msg);
                var message = "<span class='chatName'>" + player.name + "</span>" + newMsg + "<BR><BR>";
            } else var message = msg + "<BR><BR>";
            self.chat += message;
            self.sendToLobby("updateChat", message);
        },

        sendAlert: function(msg, bg, fg) {
            var data = {
                msg: msg,
                bg: bg,
                fg: fg
            }
            console.log('sending alert! ' + data.msg);
            self.sendToLobby('pushAlert', data);
        },


        // setInterval()

        resetHasDrawn: function() {
            self.players.forEach(function(e) {
                e.hasDrawn = false;
            })
        },


        remainingGuessers: function() {
            var remainingGuessers = 0;
            self.players.forEach(function(e) {
                if (e.correctlyGuessed === false && !e.isDrawing) {
                    remainingGuessers++;

                }
            })
            return remainingGuessers;
        },

        clearGuesses: function() {
            self.players.forEach(function(e) {
                e.correctlyGuessed = false;
            })
        },

        addPlayer: function(p) {
            self.sendToLobby('addPlayer', p);
            self.players.push(p);
        },

        newWord: function() {
            self.currentWord = words[Math.floor(Math.random() * words.length)].toLowerCase();
            console.log(self.currentWord);
            var json = {
                word: self.currentWord,
                count: self.roundCount
            }
            io.to(self.currentDrawer.id).emit('drawerWord', json);
            self.players.forEach(function(p) {
                if (p != currentDrawer) {
                    var json = {
                        length: self.currentWord.length,
                        count: self.roundCount
                    }
                    io.to(p.id).emit('guesserWord', json);
                }
            })
        },

        receiveChatMsg: function(data) {
            var guessedString = data.msg.toLowerCase();
            var guessedWord = (guessedString.indexOf(self.currentWord) !== -1);
            var guesser = l.idPlayer(data.id);
            if (guessedWord && (typeof self.currentDrawer !== 'undefined') && (self.currentDrawer.id != data.id) && (!guesser.correctlyGuessed)) {
                guesser.score += roundTimeLeft;
                guesser.correctlyGuessed = true;
                self.sendToLobby('updateScoreboard', guesser);
                io.to(socket.id).emit('correctGuess', self.currentWord);
                // io.emit('updateScoreboard', json);
                if (self.firstGuess) {
                    if (self.players.length > 2) {
                        self.currentDrawer.score += self.roundTimeLeft;
                        self.sendServerMsg(' has guessed correctly, earning ' + roundTimeLeft + ' points for himself and the drawer!', guesser);
                        io.emit('updateScoreboard', currentDrawer);
                    } else self.sendServerMsg(' has guessed correctly, earning ' + roundTimeLeft + ' points!', guesser);
                    self.roundTimeLeft = Math.floor(self.roundTimeLeft * (4 / 6));
                    self.firstGuess = false;
                }
                if (self.remainingGuessers() == 0) self.endRound();

            }

            if (data.length < 301 && !guessedWord) {
                var p;
                players.forEach(function(e) {
                    if (e.id === socket.id) p = e;
                });
                if (p != "undefined") {
                    self.sendChatMsg(": " + data, p);
                }
            }
            if (data.length > 300) io.to(socket.id).emit('chatTooLong');
        },




        newRound: function() {
            if (self.roundCount != 0) {
                self.sendChatMsg('Time out! The word was <span style="font-weight: bold">' + self.currentWord + '. </span>');
                self.sendAlert('Time out! The word was <span style="font-weight: bold">' + self.currentWord + "</span>.")
            }
            self.currentWord = "[-=];=-;]=-]'-[';]-';]'";
            setTimeout(function() {
                // if (players.length > 1) {
                self.clearDrawing();
                self.clearGuesses();
                self.currentDrawer = self.newDrawer();
                self.roundCount++;
                newWord();
                self.firstGuess = true;
                self.countTimer = true;
                self.roundTimeLeft = 90;
                // }
            }, 5000);

        },

        clearScores: function() {
            self.players.forEach(function(e) {
                e.score = 0;
            });
            self.sendToLobby('clearScores');
        },

        endRound: function() {
            self.roundTimeLeft = -1;
        },

        idPlayer: function(id) {

            players.forEach(function(e) {
                if (typeof(id) == 'string')
                    if (id === e.id) return e;
                if (typeof(id) == 'object')
                    if (id.id === e.id) return e;
            })
        },

        checkTimer: function() {
            if (self.countTimer) {
                if (self.roundTimeLeft > 0 && self.players.length > 1) {
                    self.roundTimeLeft--;
                    // console.log('round proceeding, ' + roundTimeLeft + ' seconds left.\n');
                    self.sendToLobby('updateTimer', self.roundTimeLeft);
                } else if (self.players.length < 2) {
                    console.log('not enough players\n')
                    self.sendServerMsg('Need more players!');
                    self.roundTimeLeft = -1;
                    self.roundCount = 10;
                } else if (self.roundTimeLeft < 1 && self.roundCount >= self.roundLimit) {
                    self.resetGame();
                    // clearDrawing();
                    self.countTimer = false;
                    // console.log('game over, restarting')
                } else if (self.roundTimeLeft < 1) {
                    // console.log('round over, new round starting.')
                    self.newRound();
                    self.countTimer = false;
                }
            }
        }
}
