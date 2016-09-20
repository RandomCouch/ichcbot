var mysql = require('mysql');
var createQuery = function(query, next) {
    var connection = mysql.createConnection({
        host: 'nickhaidar.com',
        user: 'undefined',
        password: 'undefinedBot2016!',
        database: 'bot'
    });

    connection.connect(function(err, conn) {
        if (err) {
            console.log('MySQL connection error: ', err);
            process.exit(1);
        }

    });
    connection.query(query, function(err, rows, fields) {
        if (err) throw err;
        next(rows);
    });
    connection.end();
};
function escapeHtml(text) {
  return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

exports.query = function(query, next) {
    createQuery(query, next);
};

exports.addPlay = function(username, videoID, videoTitle, next){
	videoTitle = escapeHtml(videoTitle);
	createQuery("INSERT INTO user_plays (username, video_id, video_title) VALUES ('" + username + "','" + videoID + "','" + videoTitle + "')", next);
}
exports.addMessage = function(username, message, next){
	message = escapeHtml(message);
	createQuery("INSERT INTO user_messages (username, message) VALUES ('" + username + "','" + message + "')", next);
}
exports.addLove = function(username, videoID, videoTitle, next){
	videoTitle = escapeHtml(videoTitle);
	createQuery("INSERT INTO user_loves (username, video_id, video_title) VALUES ('" + username + "','" + videoID + "','" + videoTitle + "')", next);
}
exports.addHate = function(username, videoID, videoTitle, next){
	videoTitle = escapeHtml(videoTitle);
	createQuery("INSERT INTO user_hates (username, video_id, video_title) VALUES ('" + username + "','" + videoID + "','" + videoTitle + "')", next);
}
exports.getMostTalkingUsers = function(top, next){
	if(top == ""){
		top = '5';
	}
	createQuery("SELECT username, COUNT(username) AS value_occurrence FROM user_messages GROUP BY username ORDER BY value_occurrence DESC LIMIT " + top + ";", next);
}
exports.getMostLoved = function(top, next){
	if(top == ""){
		top = '5';
	}
	createQuery("SELECT video_title, COUNT(video_id) AS value_occurence FROM user_loves GROUP BY video_id ORDER BY value_occurence DESC LIMIT " + top  + ";", next);
}
exports.getMostPlayed = function(top, next){
	if(top == ""){
		top = '5';
	}
	createQuery("SELECT video_title, COUNT(video_id) AS value_occurence FROM user_plays GROUP BY video_id ORDER BY value_occurence DESC LIMIT " + top  + ";", next);
}
exports.getMostHated = function(top, next){
	if(top == ""){
		top = '5';
	}
	createQuery("SELECT video_title, COUNT(video_id) AS value_occurence FROM user_hates GROUP BY video_id ORDER BY value_occurence DESC LIMIT " + top  + ";", next);
}