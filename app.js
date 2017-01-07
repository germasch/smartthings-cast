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
var DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;

// Google Cast

function connectAndPlay(options) {
    let client = new Client();
    
    client.connect(options, function () {
	console.log('client.connect succeeded');
	
	client.launch(DefaultMediaReceiver, function (err, player) {
	    player.on('status', function (status) {
		console.log('status broadcast playerState=%s', status.playerState);
	    });
	    
	    console.log('app "%s" launched, loading media %s ...', player.session.displayName, options.media.contentId);
	    
	    player.load(options.media, { autoplay: true }, function (err, status) {
		console.log('media loaded err=%s status=%s', err, JSON.stringify(status));
		client.close();
	    });
	});
    });
    
    client.on('error', function (err) {
	console.log('Error: %s', err.message);
	client.close();
    });
}

// REST service

let express = require('express');
let bodyParser = require('body-parser');

let app = express();
app.use(bodyParser.json({type: 'application/json'}));

app.post('/play', function (req, res) {
    console.log('Request headers: ' + JSON.stringify(req.headers, null, 4));
    console.log('Request body: ' + JSON.stringify(req.body, null, 4));

    let options = {};
    let body = req.body;
    if (!body) {
	console.log('ERROR: POST body missing.\n');
	return res.status(400).send('POST body missing.\n');
    }

    if (!body.host) {
	console.log('ERROR: "host" parameter missing.\n');
	return res.status(400).send('"host" parameter missing.\n');
    }
    options.host = body.host;

    if (body.port) {
	options.port = port;
    }

    if (!body.media) {
	console.log('ERROR: "media" parameter missing.\n');
	return res.status(400).send('"media" parameter missing.\n');
    }
    options.media = body.media;

    connectAndPlay(options);

    res.send('Now playing ' + options.media.contentId + '.\n');
});

if (module === require.main) {
    // start the server
    let server = app.listen(process.env.PORT || 8080, function () {
	let port = server.address().port;
	console.log('App listening on port %s', port);
    });
}

module.exports = app;
