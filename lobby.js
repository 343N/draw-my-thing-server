var Lobby = function(name, playerLimit, password) {
    _this = this;
    this.name = name;
    this.id = Date.now();
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
            console.log(p.name + "is drawing... " + p.isDrawing);
            console.log(this.currentDrawing.length + ' - length of drawing');
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

        this.addToDrawing = function(p, data) {
            var player = this.idPlayer(p);
            if (player.isDrawing) {
                this.sendToLobbyExcept(player.id, 'addToDrawing', data);
                this.currentDrawing.push(data);
            }
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
                poolOfDrawers = this.players;
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
            for (var i = this.players.length - 1; i >= 0; i--) {
                var e = this.players[i];
                if (e.id === p) {
                    console.log('kicking ' + e.name + ' from ' + this.name);
                    // console.log(e.name);
                    this.players.splice(i, 1);
                    this.sendToLobby('removePlayer', e.id);
                    this.sendAlert(`<span style="font-weight: bold">` + e.name + "</span> has left.");
                }
            }
            // console.log(this.players);
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
                    // if (id === e.id) console.log('sending to all but ' + e.name);
                })
            } else {
                this.players.forEach(function(e) {
                    if (id !== e.id) io.to(e.id).emit(message);
                    // if (id === e.id) console.log('sending to all but ' + e.name);
                })
            }
        },

        this.sendChatMsg = function(msg, player) {
            // console.log(player.name);
            if (typeof player === 'object') {
                var newMsg = removeHTML(msg);
                var message = "<span class='chatName'>" + player.name + "</span>" + newMsg + "<BR><BR>";
            } else var message = msg + "<BR><BR>";
            this.chat += message;
            console.log('sending chat msg ' + message);
            console.log(this.players);
            console.log(this.id);
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
            console.log(this.players);
        },


        this.receiveChatMsg = function(data) {
            // console.log(data);
            var guessedWord = false;
            if (!this.isMainLobby) {
                var guessedString = data.msg.toLowerCase();
                guessedWord = (guessedString.indexOf(this.currentWord) !== -1);
                var guesser = this.idPlayer(data.id);
                if (guessedWord && (typeof this.currentDrawer !== 'undefined') && (this.currentDrawer.id != data.id) && (!guesser.correctlyGuessed)) {
                    guesser.score += this.roundTimeLeft;
                    guesser.correctlyGuessed = true;
                    this.sendToLobby('updateScoreboard', guesser);
                    io.to(socket.id).emit('correctGuess', this.currentWord);
                    // io.emit('updateScoreboard', json);
                    if (this.firstGuess) {
                        if (this.players.length > 2) {
                            this.currentDrawer.score += this.roundTimeLeft;
                            this.sendServerMsg(' has guessed correctly, earning ' + this.roundTimeLeft + ' points for himself and the drawer!', guesser);
                            io.emit('updateScoreboard', currentDrawer);
                        } else this.sendServerMsg(' has guessed correctly, earning ' + this.roundTimeLeft + ' points!', guesser);
                        this.roundTimeLeft = Math.floor(this.roundTimeLeft * (4 / 6));
                        this.firstGuess = false;
                    }
                    if (this.remainingGuessers() == 0) this.endRound();

                }
            }

            if (data.msg.length < 301 && !guessedWord) {
                var p;
                // console.log(data.msg + ' can be sent')
                this.players.forEach(function(e) {
                    if (e.id === data.id) p = e;
                });
                if (p != "undefined") {
                    console.log(this.name + ' is not undefined');
                    this.sendChatMsg(": " + data.msg, p);
                }
            }
            if (data.length > 300) io.to(socket.id).emit('chatTooLong');
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
            var p;
            // console.log(typeof(id));
            // console.log(this.players);
            this.players.forEach(function(e) {
                // console.log(typeof(id) + ` is the IDs type`);
                if (typeof(id) === 'string') {
                    // console.log('is a string!');
                    if (id === e.id) p = e;
                }

                if (typeof(id) === 'object') {
                    // console.log('is an object!');
                    if (id.id === e.id) p = e;
                }
            });
            // console.log(p);
            return p;
        }


}
