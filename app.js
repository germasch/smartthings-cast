//
// SmartThings-Cast
//
// Copyright 2017 Kai Germaschewski
//
// This file is part of SmartThings-Cast
//
// SmartThings-Cast is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// SmartThings-Cast is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with SmartThings-Cast.  If not, see <http://www.gnu.org/licenses/>.

'use strict';

var Client = require('castv2-client').Client;
var Application = require('castv2-client').Application;
var DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;

// Google Cast

function connectAndPlayMedia(options, res) {
    let client = new Client();
    
    client.connect(options, function () {
	console.log('client.connect succeeded');
	
	client.launch(DefaultMediaReceiver, function (err, player) {
	    player.on('status', function (status) {
		console.log('status broadcast playerState=%s', status.playerState);
		if (status.playerState == "PLAYING") {
		    client.close()
		    res.send(status)
		}
	    });
	    
	    console.log('app "%s" launched, loading media %s ...', player.session.displayName, options.media.contentId);
	    
	    player.load(options.media, { autoplay: true }, function (err, status) {
		console.log('media loaded err=%s status=%s', err, JSON.stringify(status));
//		client.close();
	    });
	});
    });
    
    client.on('error', function (err) {
	console.log('Error: %s', err.message);
	client.close();
    });
}

function connectAndStop(options, res) {
    let client = new Client();
    
    client.connect(options, function () {
	console.log('client.connect succeeded');

	// client.getStatus(function (err, status) {
	//     console.log('getStatus err %s status %s', err, JSON.stringify(status, null, 4));
	// });
	client.getSessions(function (err, sessions) {
	    console.log('getSessions err %s sessions %s', err, JSON.stringify(sessions, null, 4));
	    if (!sessions.length) return res.status(204).send('No app running');
	    let session = sessions[0]
	    // FIXME, DefaultMediaReceiver might be wrong, but really, we're only using the pass-through
	    // to MediaController, so we're probably fine
	    client.join(session, DefaultMediaReceiver, function (err, p) {
		console.log("join err %s p %s", err, p);
		if (err) return res.status(400).send(err);
		p.media.currentSession = session;
		client.stop(p, function (err, result) {
		    console.log("stop err %s result %s", err, result);
		    res.send("Stopped.");
		});
	    });
	});
    });
    
    client.on('error', function (err) {
	console.log('Error: %s', err.message);
	client.close();
	res.status(400).send(err.essage)
    });
}

function connectAndPause(options, res) {
    let client = new Client();
    
    client.connect(options, function () {
	console.log('client.connect succeeded');

	client.getSessions(function (err, sessions) {
	    console.log('getSessions err %s sessions %s', err, JSON.stringify(sessions, null, 4));
	    if (!sessions.length) return res.status(400).send('No app running');
	    let session = sessions[0]
	    client.join(session, DefaultMediaReceiver, function (err, p) {
		console.log("join err %s p %s", err, p);
		if (err) return res.status(400).send(err);
		p.getStatus(function(err, result) {
		    console.log("status err %s result %s", err, JSON.stringify(result));
		    p.pause(function (err, result) {
			console.log("pause err %s result %s", err, JSON.stringify(result));
			res.send(result);
		    });
		});
	    });
	});
    });
    
    client.on('error', function (err) {
	console.log('Error: %s', err.message);
	client.close();
	res.status(400).send(err.essage)
    });
}

function connectAndPlay(options, res) {
    let client = new Client();
    
    client.connect(options, function () {
	console.log('client.connect succeeded');

	client.getSessions(function (err, sessions) {
	    console.log('getSessions err %s sessions %s', err, JSON.stringify(sessions, null, 4));
	    if (!sessions.length) return res.status(400).send('No app running');
	    let session = sessions[0]
	    client.join(session, DefaultMediaReceiver, function (err, p) {
		console.log("join err %s p %s", err, p);
		if (err) return res.status(400).send(err);
		p.getStatus(function(err, result) {
		    console.log("status err %s result %s", err, JSON.stringify(result));
		    p.play(function (err, result) {
			console.log("play err %s result %s", err, JSON.stringify(result));
			res.send(result);
		    });
		});
	    });
	});
    });
    
    client.on('error', function (err) {
	console.log('Error: %s', err.message);
	client.close();
	res.status(400).send(err.essage)
    });
}

// REST service

let express = require('express');
let bodyParser = require('body-parser');

let app = express();
app.use(bodyParser.json({type: 'application/json'}));

function getOptions(req, res) {
    console.log('Request headers: ' + JSON.stringify(req.headers, null, 4));
    console.log('Request body: ' + JSON.stringify(req.body, null, 4));

    let options = {};
    let body = req.body;
    if (!body) {
	console.log('ERROR: POST body missing.\n');
	res.status(400).send('POST body missing.\n');
	return null;
    }

    if (!body.host) {
	console.log('ERROR: "host" parameter missing.\n');
	res.status(400).send('"host" parameter missing.\n');
	return null;
    }
    options.host = body.host;

    if (body.port) {
	options.port = body.port;
    }

    return options
}

app.post('/playMedia', function (req, res) {
    let options = getOptions(req, res);
    if (!options) return;

    let body = req.body;

    if (!body.media) {
	console.log('ERROR: "media" parameter missing.\n');
	return res.status(400).send('"media" parameter missing.\n');
    }
    options.media = body.media;

    connectAndPlay(options, res);
});

app.post('/stop', function (req, res) {
    let options = getOptions(req, res);
    if (!options) return;

    connectAndStop(options, res);
});

app.post('/pause', function (req, res) {
    let options = getOptions(req, res);
    if (!options) return;

    connectAndPause(options, res);
});

app.post('/play', function (req, res) {
    let options = getOptions(req, res);
    if (!options) return;

    connectAndPlay(options, res);
});

if (module === require.main) {
    // start the server
    let server = app.listen(process.env.PORT || 8080, function () {
	let port = server.address().port;
	console.log('App listening on port %s', port);
    });
}

module.exports = app;
