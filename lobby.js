function Lobby(name, playerLimit, password){
  this.name = name;
  this.id = Date.now();
  this.playerLimit = playerLimit || 999;
  this.password = password || "";
  this.passworded = (this.password.length > 0);

  this.currentDrawing = [];
  this.players = [];


}
