var ICHC = require('./ICHC.js'),
    request = require('superagent'),
    storage = require('node-persist');

var fs = require('fs');
var parser = require('./parser.js');
var exec = require('child_process').exec;
var poker = require('./poker.js');
var proc;
var avconv = require('avconv');
//var youtube = require('youtube-feeds');
var YT = require("youtube-node");
//var youtube = require('youtube-node');
//var youTube = new youtube();
//var externalip =  require("externalip");
var SC = require('soundcloudr');
var ytdl = require('youtube-dl');
var weather = require('./yahoo.js');
var Cleverbot = require("cleverbot-node"),
cbot = new Cleverbot;
var sql = require('./sql-service.js');
var isPlaying = false;
var playingBy = "";
var playFile = "";
var AI_on = false;
var AI_on_private = false;
var AI_target = "";
var sendingToBot = false;

storage.initSync({
    dir: __dirname + '/brains'
});
var brains = storage.getItem('brains') || {
    seenUsers: [],
    masters: [],
	queue: []
}, 
save = function(){
    storage.setItem('brains', brains);
};
save();
var isMaster = function(username){
    return ~brains.masters.indexOf(username);
};
var countUserQueue = function(username){
	var n = 0;
	for(var arr in brains.queue){
		if(brains.queue[arr][2] == username){
			n++;
		}
	}
	return n;
}

var bot = ICHC({
    user: 'BOT_NAME',
    apiKey: 'API_KEY',
    room: 'ICHC_ROOM',
    debug: true
});

var chatBack = function(data, message, privacy){
    if(data.eventType == 'message' && privacy)
        bot.whisper(data.username, message);
    else if(data.eventType == 'message')
        bot.send(message);
    else 
        bot[data.eventType](data.username, message);
};
var clearQueue = function(){
	brains.queue = [];
	save();
}
var PlayingTrackID = "";
var PlayingTrackTitle = "";
var play = function(fileName, title, userName, vidID){
	//Stop anything playing 
	stop();
	isPlaying = true;
	var url = "http://www.youtube.com/watch?v=" + vidID;
	
	var stream  = "rtmp://broadcast.icanhazchat.com/ichc/z0452812b10d";
	var filePath = "";
	var command = "";
	if(vidID != "SC"){
		//ytdl(url).pipe(fs.createWriteStream("/home/dev/nodeBot/youtube/" + fileName));
		console.log("PLAYING "  + url);
		var video = ytdl(url);
		video.on('info', function(info){
			console.log("Download started");
			console.log("filename: " + info._filename);
			console.log("size: "  + info.size);
		});
		video.on('error', function error(err){
			console.log('error 2:', err);
		});
		
		video.pipe(fs.createWriteStream("/home/dev/nodeBot/youtube/" + fileName));
		
		bot.send("@" + userName + " played " + title);
		/*
		sql.addPlay(userName, vidID, title, function(){
			console.log("Added play record");
		});
		*/
		PlayingTrackID = vidID;
		PlayingTrackTitle = title;
		filePath = "/home/dev/nodeBot/youtube/" + fileName;
		
		isPlaying = true;
		playingBy = userName;
		playFile = filePath;
		
		command = "avconv -re -i " + filePath + " -preset medium -b:a 128k -b:v 256k -r 30 -s 320x240 -ar 44100 -f flv "  + stream;
	}else{
		bot.send("@" + userName + " played " + title);
		filePath = "/home/dev/nodeBot/soundcloud/" + fileName;
		PlayingTrackID = vidID;
		PlayingTrackTitle = title;
		isPlaying = true;
		playingBy = userName;
		playFile = filePath;
		
		command = "avconv -re -loop 1 -i SC.png -i " + filePath + " -tune stillimage -preset medium -b:a 128k -b:v 256k -r 30 -s 320x240 -ar 44100 -f flv "  + stream;
	}
	//var command = "avconv -re -i " + filePath + " -preset medium -b:a 128k -b:v 256k -r 30 -s 320x240 -ar 44100 -f flv "  + stream;
	setTimeout(function(){
			proc = exec(command,
				function(error, stdout, stderr){
				//Please use 640x480, 30fps, 44.1k audio, 500kbps
					console.log("stdout: " + stdout);
					console.log("stderr: "  + stderr);
					if(error !== null){
						console.log("exec error: " + error);
					}
					fs.unlinkSync(filePath);
					isPlaying = false;
					
					save();
					playQueue();
				});
		}, 7000);
		
}
var stop = function(){
	var terminate = exec("sudo killall -9 avconv", function(error, stdout, stderr){
		console.log("terminate out : " + stdout);
		console.log("terminate err: " +stderr);
	});
}
var playIdle = function(){
	var filePath = "/home/dev/nodeBot/idle.jpg";
	var stream  = "rtmp://broadcast.icanhazchat.com/ichc/z0452812b10d";
	proc = exec("avconv -loop 1 -i " + filePath + " -c:v libx264 -tune stillimage -pix_fmt yuv420p -r 30 -s 320x240 -f flv " + stream,
		function(error, stdout, stderr){
			console.log("[playIdle] stdout: " + stdout);
			console.log("[playIdle] stderr: " + stderr);
		});
}
var playQueue = function(){
	save();
	console.log("Current queue: " + JSON.stringify(brains.queue));
	if(brains.queue.length > 0 && !isPlaying){
		var fileName = brains.queue[0][0];
		var userName = brains.queue[0][2];
		var vidID = brains.queue[0][3];
		var title = brains.queue[0][1];
		playingBy = userName;
		isPlaying = true;
		play(fileName, title, userName, vidID);
		brains.queue.splice(0, 1);
	} else if(brains.queue[0] == null || brains.queue[0] == "undefined"){
		isPlaying = false;
		playIdle();
	}
}
function escapeHtml(text) {
  return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}
var commands = {
    help:{
        regex: /^!help\b/,
        run: function(data){
            var cmds = [],
            username = data.username;
            for(var cmd in commands){
                var command = commands[cmd];
                if(command.master && isMaster(username))
                    cmds.push(cmd);
                if(!command.master)
                    cmds.push(cmd);
            }
            bot.pm(data.username, '**Commands available to you:** !' + cmds.join(' !') );
        }
    },
 
    masterlist:{
	master: false,
        regex: /^!masterlist\b/,
        run: function(data){
		console.log("MASTER");
		console.log("MASTERS: " + brains.masters.join(", "));
            chatBack(data, '**Current Bot Masters:** ' + brains.masters.join(' '), false);
        }
    },
 
    master:{
        master: true,
        regex: /^!master (.+)/,
        run: function(data){
            var username = data.message.match(this.regex)[1];
            brains.masters.push(username);
            save();
            chatBack(data, 'Added ' + username + ' to the master list', true);
            bot.whisper(username, data.username + ' just added you to the bot masters list. You have access to more commands now.');
        }
    },
 
    unmaster:{
        master: true,
        regex: /!unmaster (.+)/,
        run: function(data){
            var username = data.message.match(this.regex)[1];
			if(username != "wiwi"){
            brains.masters = brains.masters.filter(function(x){ return x !== username; });
            save();
            chatBack(data, 'Removed ' + username + ' from the master list', true);
            bot.whisper(username, data.username + ' has removed you from the master list.');
			} else {
				chatBack(data,"**Can't unmaster the master**", false);
			}
        }
    },
	q:{
		regex: /!q\b/,
		run: function(data){
			var queueStr = "";
			for(arr in brains.queue){
				var title = brains.queue[arr][1];
				var usr = brains.queue[arr][2];
				queueStr += " " + usr + ": " + title + " || ";
			}
			if(brains.queue.length > 0){
				chatBack(data, '@' + data.username + " Queue: " + queueStr, false);
			} else {
				chatBack(data, '@' + data.username + " Queue is empty ", false);
			}
		}
	},
	poker:{
		master:false,
		regex: /^!poker (.+)/,
		run: function(data){
			var players = data.message.split("!poker ")[1].split(",");
			for(var i in players){
				players[i] = players[i].trim();
			}
			poker.initializeGame(players);
			poker.getCards(function(playersP){
				var playersStr = "";
				if(playersP.length != 0){
					for(var x in playersP){
						playersStr += "@" + playersP[x].name + " ";
						var pName = playersP[x].name;
						var pHand = playersP[x].hand.join(" ");
						bot.pm(pName, "Your hand is " + encodeURIComponent(pHand));
					}
					
				}
				bot.send("Poker game started with " + playersStr);
				
			});
			
		}
	},
    say:{
        master: true,
        regex: /^!say (.+)/,
        run: function(data){
            bot.send(data.message.match(this.regex)[1]);
        }
    },
 
    hi:{
        regex: /^!hi\b/,
        run: function(data){
            chatBack(data, 'Oh, hi @' + data.username + '!');
        }
    },
	
	weather:{
		regex: /^!weather (.+)/,
		run:function(data){
			var query = data.message.split("!weather")[1];
			console.log("check weather in " + query);
			var url = "http://api.openweathermap.org/data/2.5/weather?q=" + query + "&APPID=91670184a6a1c470a5b32761a739b67f";
			request.get(url)
			.end(function(err, response){
				if(!response.ok){
					console.log('Request error: ' + response.text);
					return;
				}
				var lines = response.text.split(/\n/);
				console.log("Response: " + response.text);
				var jsonResponse = JSON.parse(response.text);
				if(jsonResponse.cod != "404"){
					var temp = jsonResponse.main.temp;
					var celcTemp = Math.round((parseInt(temp) - 273.15) * 100) / 100;
					var fTemp = (celcTemp * 1.8000) + 32;
					var pressure = jsonResponse.main.pressure;
					var humidity = jsonResponse.main.humidity;
					var windSpeed = jsonResponse.wind.speed;
					var windDeg = jsonResponse.wind.deg;
					var cityName = jsonResponse.name;
					var country = jsonResponse.sys.country;
					var condition = jsonResponse.weather[0].description;
					var weatherStr = "Weather in " + cityName + ", " + country + " : Conditions: " + condition + " | Temperature: " + fTemp + " F/ " + celcTemp + " C | Pressure: " + pressure + " | Humidity : " + humidity + "% | Wind speed " + windSpeed + "MPH at " + windDeg + " degrees";
					chatBack(data, "@" + data.username + " " + weatherStr, false);
				} else {
					chatBack(data, "@" + data.username + " " + query + " not found. ", false);
				}
		   });
		}
	},
	
    calc:{ // ohms law calculator
        regex: /^!calc (.+)/,
        run: function(data){
		console.log("DATA: " + data.message);
		var equation = data.message.split("!calc ")[1];
		if (!equation.match(/[a-z#$&=!@]/i)) {
		    // alphabet letters found
		    var expression = parser.Parser.parse(equation);
		    var result = expression.evaluate();
			chatBack(data, "@" + data.username + ": " + result, false);
		} else {
			chatBack(data, "Invalid formula", false);
		}
        }
    },
	camDown:{
		master: true,
		regex: /^!camDown\b/,
		run: function(data){
			bot.send("/cam off");
		}
	},
	clearQueue:{
		master: true,
		regex: /^!clearQueue\b/,
		run: function(data){
			clearQueue();
		}
	},
	stop:{
		regex: /^!stop\b/,
		run: function(data){	
			if(!isMaster(data.username)){
				if(playingBy == data.username){
					if(isPlaying){
						var terminate = exec("sudo killall -9 avconv", function(error, stdout, stderr){
							console.log("terminate out : " + stdout);
							console.log("terminate err: " +stderr);
							isPlaying = false;
							playQueue();
						});
					} else {
						chatBack(data, "@" + data.username + " Nothing is playing... :facepalm ");
					}
				}
			} else {
				if(isPlaying){
						var terminate = exec("sudo killall -9 avconv", function(error, stdout, stderr){
							console.log("terminate out : " + stdout);
							console.log("terminate err: " +stderr);
							isPlaying = false;
							playQueue();
						});
				} else {
					chatBack(data, "@" + data.username + " Nothing is playing... :facepalm ", false);
				}
			}
		}
	},
	nvm:{
		regex: /^!nvm\b/,
		run: function(data){
			//remove this user's last play from the queue 
			var userPlays = [];
			for(arr in brains.queue){
				var title = brains.queue[arr][1];
				var usr = brains.queue[arr][2];
				if(usr == data.username){
					userPlays.push(brains.queue[arr]);
				}
			}
		}
	},
	sc:{
		regex: /^!sc (.+)/,
		run: function(thisData){
			bot.send("/cam audio-on");
			var query = thisData.message.split("!sc ")[1];
			
			SC.setClientId("05cb30fd82557afab2ac8e7abd0ff7b5");
			SC.getStreamUrl(query, function(err, url){
				if(err){
					return console.log("Error SC: " + err.message);
				}
				console.log("STREAM URL : " + url);
				var nQueues = countUserQueue(thisData.username);
				//playQueue();
				var songUrl = query.split("/");
				var songName = songUrl[songUrl.length - 1];
				var fileSongName = songName.replace(" ", "");
				fileSongName += ".mp3";
				//Download the song
				
				var request = require('request');
				var file = fs.createWriteStream("soundcloud/"  + fileSongName);
				request.get(url).auth(null, null, true, null).pipe(file);
				
				
				if(!isMaster(thisData.username)){
					if(nQueues < 2){
					//ytdl(url).pipe(fs.createWriteStream("/home/dev/nodeBot/youtube/" + fileName));
					brains.queue.push([fileSongName, songName, thisData.username, "SC"]);
					chatBack(thisData, "You have added " + songName + " to the queue in position " + brains.queue.length, true);
					//playQueue();
					} else {
						chatBack(thisData, "@" + thisData.username + " you already have 2 videos in the queue, please wait for them to finish before queueing more videos", false);
					}
				} else {
					//ytdl(url).pipe(fs.createWriteStream("/home/dev/nodeBot/youtube/" + fileName));
					brains.queue.push([fileSongName, songName, thisData.username, "SC"]);
					chatBack(thisData, "You have added " + songName + " to the queue in position " + brains.queue.length, true);
					//playQueue();
				}
				playQueue();
			});
		}
	},
	play:{
		regex: /^!play (.+)/,
		run: function(thisData){
			bot.send("/cam audio-on");
			var query = thisData.message.split("!play ")[1];
				var inputLink;
				var title;
				var vidID;
				//Get video data
					var yt = new YT();
					yt.setKey("AIzaSyBu3BJZO_RbciSPU6y7U16_Oc5x-r_nKV8");
					yt.search(query, 2, function(err, result){
						if(err){
							console.log(err);
						} else{ 
							var found = false;
							for(var r of result.items){
								
								console.log("Item type : " + r.id.kind);
								var kind = r.id.kind;
									if(kind == "youtube#video" && !found){
										found = true;
										vidID = r.id.videoId;
										title = r.snippet.title;
										var nQueues = countUserQueue(thisData.username);
										if(vidID !== "undefined"){
											//youtubedl
											var url = "http://www.youtube.com/watch?v=" + vidID;
											var fileName =  vidID + ".mp4";
											console.log("Saving video to : /youtube/" + fileName);
											//brains.queue.push([fileName, title, thisData.username]);
											
											if(!isMaster(thisData.username)){
												if(nQueues < 2){
												//ytdl(url).pipe(fs.createWriteStream("/home/dev/nodeBot/youtube/" + fileName));
												brains.queue.push([fileName, title, thisData.username, vidID]);
												chatBack(thisData, "You have added " + title + " to the queue in position " + brains.queue.length, true);
												playQueue();
												} else {
													chatBack(thisData, "@" + thisData.username + " you already have 2 videos in the queue, please wait for them to finish before queueing more videos", false);
												}
											} else {
												//ytdl(url).pipe(fs.createWriteStream("/home/dev/nodeBot/youtube/" + fileName));
												brains.queue.push([fileName, title, thisData.username, vidID]);
												chatBack(thisData, "You have added " + title + " to the queue in position " + brains.queue.length, true);
												playQueue();
											}
											//bot.send("@" + data.username + " played " + title);
										} else {
											bot.send("No video found");
										}
									}
								}
							}
						});
				
		}
	},
	note:{
		master:true,
		regex: /^!note (.+)/,
		run: function(data){
			var user =  data.message.split("!note ")[1].split(" ")[0];
			var note = data.message.split("!note " + user + " ")[1];
			sql.query("INSERT INTO user_notes (username,note,addedBy) VALUES ('" + user + "','" + note + "','" + data.username + "')", function(){
				console.log("Added note for " + user);
			});
			chatBack(data, "Note added successfully");
		},
	},
	love:{
		master:false,
		regex: /^!love\b/,
		run: function(data){
			var userName = data.username;
			//get current song playing
			var vidID = PlayingTrackID;
			var title = PlayingTrackTitle;
			/*
			sql.addLove(userName, vidID, title, function(){
				console.log("Added love record");
			});
			chatBack(data, "+1 love for " + title + "!", true);
			*/
		}
	},
	hate:{
		master:false,
		regex: /^!hate\b/,
		run: function(data){
			var userName = data.username;
			//get current song playing
			var vidID = PlayingTrackID;
			var title = PlayingTrackTitle;
			/*
			sql.addHate(userName, vidID, title, function(){
				console.log("Added hate record");
			});
			chatBack(data, "+1 hate for " + title + "!", true);
			*/
		}
	},
	mostLoved: {
		maser:false,
		regex: /^!mostLoved (.+)/,
		run: function(data){
			var top = data.message.split("!mostLoved ")[1];
			var mostLoved;
			if(isNaN(top)){
				top = "";
			}
			/*
			sql.getMostLoved(top, function(results){
				console.log("Got results: " + JSON.stringify(results));
				mostLoved = results;
				var msgBack = "Top " + top + " loved tracks : ";
				for(var i in results){
					var num = parseInt(i)+1;
					var title = results[i].video_title.replace("&#039;", "'");
					msgBack += num + ". " + title + " || ";
				}
				bot.send(msgBack);
			});
			*/
		}
	},
	mostPlayed: {
		maser:false,
		regex: /^!mostPlayed (.+)/,
		run: function(data){
			var top = data.message.split("!mostPlayed ")[1];
			var mostLoved;
			if(isNaN(top)){
				top = "";
			}
			/*
			sql.getMostPlayed(top, function(results){
				console.log("Got results: " + JSON.stringify(results));
				mostLoved = results;
				var msgBack = "Top " + top + " played tracks : ";
				for(var i in results){
					var num = parseInt(i)+1;
					var title = results[i].video_title.replace("&#039;", "'");
					msgBack += num + ". " + title + " || ";
				}
				bot.send(msgBack);
			});
			*/
		}
	},
	mostHated: {
		maser:false,
		regex: /^!mostHated (.+)/,
		run: function(data){
			var top = data.message.split("!mostHated ")[1];
			var mostLoved;
			if(isNaN(top)){
				top = "";
			}
			/*
			sql.getMostHated(top, function(results){
				console.log("Got results: " + JSON.stringify(results));
				mostLoved = results;
				var msgBack = "Top " + top + " hated tracks : ";
				for(var i in results){
					var num = parseInt(i)+1;
					var title = results[i].video_title.replace("&#039;", "'");
					msgBack += num + ". " + title + " || ";
				}
				bot.send(msgBack);
			});
			*/
		}
	},
	topChat: {
		master:false,
		regex: /^!topChatters (.+)/,
		run: function(data){
			var top = data.message.split("!topChatters ")[1];
			var mostLoved;
			if(isNaN(top)){
				top = "";
			}
			/*
			sql.getMostTalkingUsers(top, function(results){
				console.log("Got results: " + JSON.stringify(results));
				mostLoved = results;
				var msgBack = "Top " + top + " chatters : ";
				for(var i in results){
					var num = parseInt(i)+1;
					var title = results[i].username;
					msgBack += num + ". " + title + " || ";
				}
				bot.send(msgBack);
			});
			*/
		}
	},
    broadcast:{
		master:true,
		regex: /^!broadcast\b/,
		run: function(data){
			bot.send("/broadcast");
			bot.send("/cam onx");
		}
    },
	ai:{
		master:true,
		regex: /^!ai\b/,
		run: function(data){
			if(!AI_on){
				chatBack(data, "** Activating AI. ** " , false);
				AI_on = true;
			} else {
				chatBack(data, "** De-activating AI. **" , false);
				AI_on = false;
			}
		}
	},
	aiTarget: {
		master:true,
		regex: /^!aiTarget (.+)/,
		run:function(data){
			var target = data.message.split("!aiTarget ")[1];
			AI_target = target;
			chatBack(data, "** Unleashing AI wrath on " + AI_target + " ** " , true);
			bot.send("/tellmods ** Unleashing AI wrath on " + AI_target + " ** ");
			bot.send("/privmsg " + target + " Hey there");
		}
	},
    restart:{
		master:true,
		regex: /^!restart\b/,
		run: function(data){
			bot.send("**Restarting... **");
			setTimeout(function(){
				process.exit();
			}, 500);
		}
    }
};
bot.on('message whisper pm mods', function(data){
    var username = data.username;
	var isCommand = false;
    for(var command in commands){
        command = commands[command];
        if(command.regex.test(data.message)){
			isCommand = true;
            if(command.master && isMaster(username) || username == "wiwi" && command.master)
                command.run(data);
            if(!command.master)
                command.run(data);
        }
    }
	if(!isCommand){
		if(AI_on && data.username != "undefined" && data.username != "icanhazchat"){
					
					var m = data.message;
					console.log("SENDING BOT: " + m);
					Cleverbot.prepare(function(){
						cbot.write(m, function(response){
							chatBack(data, "@" + username + " " + response.message, false);
						});
					});
					
				
		}
		if(username != "icanhazchat"){
			var nMsg = data.message.replace("\\", " ");
			/*
			sql.addMessage(username, nMsg, function(){
				console.log("Added message record");
			});
			*/
		}
	}
		
}).
on('pm', function(data){
	if(AI_target != "" && data.username == AI_target){
			var m = data.message;
			bot.send("/tellmods [AI SESSION] " + AI_target + ": " + m);
			Cleverbot.prepare(function(){
				cbot.write(m, function(response){
					chatBack(data, response.message, true);
					bot.send("/tellmods [AI SESSION] undefined: " + response.message);
				});
			});
	}
}).
on('userJoin', function(data){

    var username = data.username;
	var realUsername = data.username.split("!")[0];
	var query = "SELECT * FROM user_notes WHERE username='" + realUsername + "' ORDER BY date";
	/*
	sql.query(query, function(result){
		if(result.length > 0){
			for(var i in result){
				var note = result[i].note;
				var addedBy = result[i].addedBy;
				var date = result[i].date;
				bot.send("/tellmods " + realUsername + " has joined the room and should be watched for: " + note + " - " + addedBy);
			}
		}
	});
	*/
    
}).
on('error', function(data){
    console.log('ERROR: ' + data.message);
}).
on('connect', function(data){
	bot.send("**I'm back!**");
	clearQueue();
	bot.send("/broadcast");
	setTimeout(function(){
		bot.send("/cam onx");
		playQueue();
	}, 1000);
}).
connect(function(data){
   // this.whisper('wiwi','Happy birthday!');
});