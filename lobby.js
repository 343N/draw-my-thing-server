var Lobby = function(name, playerLimit, password) {
    _this = this;
    this.name = name;
    this.id = Date.now() + Math.floor(100 * Math.random());
    this.playerLimit = playerLimit || 999;
    this.password = password || "";
    this.passworded = (this.password.length > 0);
    this.isMainLobby = false;
    this.isPersistent = false;

    this.currentDrawing = [];
    this.players = [];
    this.currentDrawer;
    this.currentWord;
    this.roundCount = 0;
    this.firstGuess = 0;
    this.roundLimit = 10;
    this.roundTimeLeft = -1;
    this.countTimer = true;
    this.chat = '';


    this.undoDrawing = function(p) {
            var p = this.idPlayer(p);
            if (p.isDrawing && this.currentDrawing.length > 0) {
                for (var i = this.currentDrawing.length - 1; i >= 0; i--) {
                    if (this.currentDrawing[i].begin) {
                        console.log(i);
                        for (var j = this.currentDrawing.length - 1; j >= i; j--) {
                            this.currentDrawing.splice(j, 1);
                        }
                        console.log('undoing drawing..');
                        this.sendToLobby('undoDrawing');
                        break;
                    }
                }
            }
        },

        this.addToDrawing = function(p) {
            var player = idPlayer(p);
            if (player.isDrawing) {
                this.sendToLobby('addToDrawing', data);
                currentDrawing.push(data);
            }
        },


        this.resetGame = function() {
            this.roundCount = 0
            this.roundLimit = this.players.length * 3;
            this.clearScores();
            this.resetHasDrawn();
            this.sendServerMsg('Game over!')
            this.sendServerMsg('New game in 10 seconds.');
            setTimeout(this.newRound, 5000);
        },

        this.newDrawer = function() {
            var drawers = this.getHasntDrawn();
            var rand = Math.random() * drawers.length;
            var num = Math.floor(rand);
            var p = drawers[num];
            p.isDrawing = true;
            p.hasDrawn = true;
            this.sendToLobby('isDrawing', p);
            this.sendServerMsg(' is drawing!', p);
            return p;

        },

        this.getHasntDrawn = function() {
            var poolOfDrawers = [];
            this.players.forEach(function(e) {
                if (e.hasDrawn == false) poolOfDrawers.push(e);
            });
            if (poolOfDrawers.length === 0) {
                this.resetHasDrawn();
                poolOfDrawers = players;
            }
            return poolOfDrawers;
        },

        this.clearDrawing = function() {
            this.sendToLobby('clearDrawing');
            this.currentDrawing = [];
            this.players.forEach(function(e) {
                e.isDrawing = false;
            })
        },

        this.sendServerMsg = function(msg, player) {
            if (typeof player === 'object') {
                var message = `<span class="chatName" style="color: rgba(200,200,255,1); font-weight: bold;">` + player.name + `</span> <span style="color: rgba(150,150,255,1)">` + msg + "</span><BR><BR>";
            } else var message = '<span style="color: rgba(200,200,255,1);">' + msg + "</span><BR><BR>";
            this.chat += message;
            this.sendToLobby("updateChat", message);
        },

        this.playerLeave = function(p) {
            for (var i = this.players.length - 1; i >= 0; i--){
              var e = this.players[i];
                if (e.id === p) {
                    this.players.splice(i, 1);
                    console.log(this);
                    console.log(_this.name);
                    console.log(this.name);
                    console.log('kicking ' + this.players.name + ' from ' + this.name);
                    this.sendToLobby('removePlayer', e.id);
                    this.sendAlert(`<span style="font-weight: bold">` + e.name + "</span> has left.");
                }
            }
        },

        // this.playerJoin(p){
        // }



        this.sendToLobby = function(message, data) {
            if (data) {
                this.players.forEach(function(e) {
                    io.to(e.id).emit(message, data)
                })
            } else {
                this.players.forEach(function(e) {
                    io.to(e.id).emit(message)
                })
            }
        },

        this.sendToLobbyExcept = function(id, message, data) {
            if (data) {
                this.players.forEach(function(e) {
                    if (id !== e.id) io.to(e.id).emit(message, data);
                })
            } else {
                this.players.forEach(function(e) {
                    if (id !== e.id) io.to(e.id).emit(message);
                })
            }
        },

        this.sendChatMsg = function(msg, player) {
            if (typeof player === 'object') {
                var newMsg = removeHTML(msg);
                var message = "<span class='chatName'>" + player.name + "</span>" + newMsg + "<BR><BR>";
            } else var message = msg + "<BR><BR>";
            this.chat += message;
            this.sendToLobby("updateChat", message);
        },

        this.sendAlert = function(msg, bg, fg) {
            var data = {
                msg: msg,
                bg: bg,
                fg: fg
            }
            console.log('sending alert! ' + data.msg);
            this.sendToLobby('pushAlert', data);
        },


        // setInterval()

        this.resetHasDrawn = function() {
            this.players.forEach(function(e) {
                e.hasDrawn = false;
            })
        },


        this.remainingGuessers = function() {
            var remainingGuessers = 0;
            this.players.forEach(function(e) {
                if (e.correctlyGuessed === false && !e.isDrawing) {
                    remainingGuessers++;

                }
            })
            return remainingGuessers;
        },

        this.clearGuesses = function() {
            this.players.forEach(function(e) {
                e.correctlyGuessed = false;
            })
        },

        this.addPlayer = function(p) {
            this.sendToLobby('addPlayer', p);
            this.players.push(p);
        },

        this.newWord = function() {
            this.currentWord = words[Math.floor(Math.random() * words.length)].toLowerCase();
            console.log(this.currentWord);
            var json = {
                word: this.currentWord,
                count: this.roundCount
            }
            io.to(this.currentDrawer.id).emit('drawerWord', json);
            this.players.forEach(function(p) {
                if (p != currentDrawer) {
                    var json = {
                        length: this.currentWord.length,
                        count: this.roundCount
                    }
                    io.to(p.id).emit('guesserWord', json);
                }
            })
        },

        this.receiveChatMsg = function(data) {
            var guessedString = data.msg.toLowerCase();
            var guessedWord = (guessedString.indexOf(this.currentWord) !== -1);
            var guesser = l.idPlayer(data.id);
            if (guessedWord && (typeof this.currentDrawer !== 'undefined') && (this.currentDrawer.id != data.id) && (!guesser.correctlyGuessed)) {
                guesser.score += roundTimeLeft;
                guesser.correctlyGuessed = true;
                this.sendToLobby('updateScoreboard', guesser);
                io.to(socket.id).emit('correctGuess', this.currentWord);
                // io.emit('updateScoreboard', json);
                if (this.firstGuess) {
                    if (this.players.length > 2) {
                        this.currentDrawer.score += this.roundTimeLeft;
                        this.sendServerMsg(' has guessed correctly, earning ' + roundTimeLeft + ' points for himself and the drawer!', guesser);
                        io.emit('updateScoreboard', currentDrawer);
                    } else this.sendServerMsg(' has guessed correctly, earning ' + roundTimeLeft + ' points!', guesser);
                    this.roundTimeLeft = Math.floor(this.roundTimeLeft * (4 / 6));
                    this.firstGuess = false;
                }
                if (this.remainingGuessers() == 0) this.endRound();

            }

            if (data.length < 301 && !guessedWord) {
                var p;
                players.forEach(function(e) {
                    if (e.id === socket.id) p = e;
                });
                if (p != "undefined") {
                    this.sendChatMsg(": " + data, p);
                }
            }
            if (data.length > 300) io.to(socket.id).emit('chatTooLong');
        },




        this.newRound = function() {
            if (this.roundCount != 0) {
                this.sendChatMsg('Time out! The word was <span style="font-weight: bold">' + this.currentWord + '. </span>');
                this.sendAlert('Time out! The word was <span style="font-weight: bold">' + this.currentWord + "</span>.")
            }
            this.currentWord = "[-=];=-;]=-]'-[';]-';]'";
            setTimeout(function() {
                // if (players.length > 1) {
                this.clearDrawing();
                this.clearGuesses();
                this.currentDrawer = this.newDrawer();
                this.roundCount++;
                newWord();
                this.firstGuess = true;
                this.countTimer = true;
                this.roundTimeLeft = 90;
                // }
            }, 5000);

        },

        this.clearScores = function() {
            this.players.forEach(function(e) {
                e.score = 0;
            });
            this.sendToLobby('clearScores');
        },

        this.endRound = function() {
            this.roundTimeLeft = -1;
        },

        this.idPlayer = function(id) {

            players.forEach(function(e) {
                if (typeof(id) == 'string')
                    if (id === e.id) return e;
                if (typeof(id) == 'object')
                    if (id.id === e.id) return e;
            })
        },

        this.checkTimer = function() {
            if (this.countTimer) {
                if (this.roundTimeLeft > 0 && this.players.length > 1) {
                    this.roundTimeLeft--;
                    // console.log('round proceeding, ' + roundTimeLeft + ' seconds left.\n');
                    this.sendToLobby('updateTimer', this.roundTimeLeft);
                } else if (this.players.length < 2) {
                    console.log('not enough players\n')
                    this.sendServerMsg('Need more players!');
                    this.roundTimeLeft = -1;
                    this.roundCount = 10;
                } else if (this.roundTimeLeft < 1 && this.roundCount >= this.roundLimit) {
                    this.resetGame();
                    // clearDrawing();
                    this.countTimer = false;
                    // console.log('game over, restarting')
                } else if (this.roundTimeLeft < 1) {
                    // console.log('round over, new round starting.')
                    this.newRound();
                    this.countTimer = false;
                }
            }
        }
}
