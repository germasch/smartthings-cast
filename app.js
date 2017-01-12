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
var debug = require('debug')('cast');

// Google Cast

let ctx = {};
ctx.setStatus = function(ctx, status) {
    ctx.status = status;
    if (status.applications) {
	console.log("setStatus -> %s", status.applications[0].statusText);
    }
}

ctx.setMediaStatus = function(ctx, status) {
    if (!status) {
	return;
    }
    ctx.mediaStatus = status;
    console.log("setMediaStatus -> %s", status.playerState);
}

function connect(ctx) {
    return new Promise(function(resolve, reject) {
	debug("connect");
	debug("Request headers: ", ctx.req.headers);
	debug("Request body:", ctx.req.body);

	let body = ctx.req.body;
	if (!body) {
	    return reject(new Error("POST body missing."));
	}
	
	let address = {};
	
	if (!body.host) {
	    return reject(new Error("'host' parameter missing."));
	}
	address.host = body.host;

	if (body.port) {
	    address.port = body.port;
	}

	var client = new Client();
	client.connect(address, function () {
	    ctx.client = client;
	    resolve(ctx);
	});

	var onStatus = function (status) {
	    ctx.setStatus(ctx, status);
	};
	var onError = function (err) {
	    console.log("Error: %s", err);
	    client.removeListener("error", onError);
	    reject(err);
	};
	client.on("error", onError);
	client.on("status", onStatus);
    });
}

function getStatus(ctx) {
    return new Promise(function(resolve, reject) {
	debug("getStatus");
	ctx.client.getStatus(function(err, status) {
	    if (err) {
		return reject(err);
	    }
	    ctx.setStatus(ctx, status);
	    resolve(ctx);
	});
    });
}

function launch(ctx) {
    return new Promise(function(resolve, reject) {
	debug("launch");
	ctx.client.launch(DefaultMediaReceiver, function (err, app) {
	    if (err) {
		return reject(err);
	    }
	    var onStatus = function(status) {
		ctx.setMediaStatus(ctx, status);
            };
	    app.on('status', onStatus);
	    if (app.setPlatform) {
		app.setPlatform(ctx.client);
	    }
	    ctx.app = app;
	    resolve(ctx);
	});
    });
}

function load(ctx) {
    return new Promise(function(resolve, reject) {
	debug("load");
	let body = ctx.req.body;

	if (!body.media) {
	    return reject(new Error('"media" parameter missing.\n'));
	}

	ctx.app.load(body.media, { autoplay: true }, function (err, status) {
	    if (err) {
		return reject(err);
	    }
	    ctx.mediaStatus = status;
	    resolve(ctx);
	});
    });
}

function getSessions(ctx) {
    return new Promise(function(resolve, reject) {
	debug("getSessions");
	ctx.client.getSessions(function (err, sessions) {
	    if (err) {
		return reject(err);
	    }
	    if (sessions.length) {
		ctx.session = sessions[0];
	    } else {
		// FIXME, not really an error, unless trying to join
		//return reject(new Error("no session to join"));
	    }
	    resolve(ctx);
	});
    });
}

function getMediaStatus(ctx) {
    debug("getMediaStatus");
    return new Promise(function(resolve, reject) {
	ctx.app.getStatus(function(err, status) {
	    if (err) {
		return reject(err);
	    }
	    // not sure why this needs to be called here,
	    // mostly the onStatus handler seems to take care of it
	    ctx.setMediaStatus(ctx, status);
	    resolve(ctx);
	});
    });
}

function join(ctx) {
    return new Promise(function(resolve, reject) {
	debug("join");
	// FIXME? DefaultMediaReceiver is actually too specialized, it could be some other app
	ctx.client.join(ctx.session, DefaultMediaReceiver, function (err, app) {
	    if (err) {
		return reject(err);
	    }
	    if (app.setPlatform) {
		app.setPlatform(ctx.client);
	    }
	    var onStatus = function(status) {
		ctx.setMediaStatus(ctx, status);
            };
	    app.on('status', onStatus);
	    ctx.app = app;
	    resolve(ctx);
	});
    });
}

function stop(ctx) {
    return new Promise(function(resolve, reject) {
	debug("stop");
//	ctx.client.stop(ctx.app, function (err, result) {
	ctx.app.stop(function (err, result) {
	    if (err) {
		return reject(err);
	    }
	    resolve(ctx);
	});
    });
}

function pause(ctx) {
    return new Promise(function(resolve, reject) {
	debug("pause");
	ctx.app.pause(function (err, result) {
	    if (err) {
		return reject(err);
	    }
	    resolve(ctx);
	});
    });
}

function play(ctx) {
    return new Promise(function(resolve, reject) {
	debug("play");
	ctx.app.play(function (err, result) {
	    if (err) {
		return reject(err);
	    }
	    resolve(ctx);
	});
    });
}

function attach(ctx) {
    return connect(ctx)
	.then(getStatus)
	.then(getSessions)
	.then(function (ctx) {
	    if (ctx.session) {
		return join(ctx)
		    .then(getMediaStatus);
	    } else {
		return ctx;
	    }
	})
};

function sendResponse(ctx) {
    var msg = {};
    if (ctx.status) { msg.status = ctx.status };
    if (ctx.mediaStatus) { msg.mediaStatus = ctx.mediaStatus };
    debug("sendResponse:", msg);
    ctx.res.send(msg);
    ctx.client.close();
}

function sendErrorResponse(ctx, code, err) {
    debug("SendErrorResponse(%d): %s", code, err);
    ctx.res.status(code).send(err + "\n");
    if (ctx.client) {
	ctx.client.close();
    }
}

// REST service

let express = require('express');
let bodyParser = require('body-parser');

let app = express();
app.use(bodyParser.json({type: 'application/json'}));

function getOptions(req, res) {
    ctx.req = req;
    ctx.res = res;
    ctx.options = {};

    return ctx;
}

app.post('/playMedia', function (req, res) {
    let ctx = getOptions(req, res);

    connect(ctx)
	.then(launch)
	.then(load)
	.then(function(ctx) {
	    return new Promise(function(resolve, reject) {
		var onStatus = function (status) {
		    if (status.playerState == "PLAYING") {
			sendResponse(ctx);
			resolve(ctx);
		    } // FIXME, probably should do a timeout if we aren't getting "PLAYING"
		};
		ctx.app.on("status", onStatus);
	    });
	})
	.catch(function(err) {
	    sendErrorResponse(ctx, 400, err);
	});
});

app.post('/stop', function (req, res) {
    let ctx = getOptions(req, res);

    attach(ctx)
	.then(stop)
	.then(sendResponse)
	.catch(function(err) { 
	    sendErrorResponse(ctx, 400, err);
	});
});

app.post('/pause', function (req, res) {
    let ctx = getOptions(req, res);

    attach(ctx)
	.then(pause)
	.then(sendResponse)
	.catch(function(err) { 
	    sendErrorResponse(ctx, 400, err);
	});
});

app.post('/play', function (req, res) {
    let ctx = getOptions(req, res);

    attach(ctx)
	.then(play)
	.then(sendResponse)
	.catch(function(err) { 
	    sendErrorResponse(ctx, 400, err);
	});
});

app.post('/status', function (req, res) {
    let ctx = getOptions(req, res);

    attach(ctx)
	.then(sendResponse)
	.catch(function(err) { 
	    sendErrorResponse(ctx, 400, err);
	});
});

if (module === require.main) {
    // start the server
    let server = app.listen(process.env.PORT || 8080, function () {
	let port = server.address().port;
	console.log('App listening on port %s', port);
    });
}

module.exports = app;
