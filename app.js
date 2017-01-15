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

// FIXME, rather than just ignoring commands that don't fit current state
// (e.g., play when no app is loaded), we should return an appropriate status

// body.media -> put into options

// whole object mess

// googleplaymusic doesn't react instanteneously to pause/play, so will have to listen for updated status


'use strict';

var Client = require('castv2-client').Client;
var DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
var debug = require('debug')('chromecast');

// Response

function Response(code, response) {
    this.code = code;
    this.response = response;
}

// Google Cast

function Chromecast(req, res) {
    //debug("Request headers: ", req.headers);
    debug("Request body:", req.body);

    this.req = req;
    this.res = res;
    this.options = {};

    let body = req.body;
    if (!body) return;
    
    if (!body.host) return;
    this.options.address = { host: body.host };
    
    if (body.port) { this.options.address.port = body.port; }
}

Chromecast.prototype._setStatus = function(status) {
    this.status = status;
    if (status.applications) {
	debug("setStatus: volume -> %s statusText -> %s", status.volume.level,
	      status.applications[0].statusText);
    } else {
	debug("setStatus: volume -> %s", status.volume.level);
    }
}

Chromecast.prototype._setMediaStatus = function(status) {
    // FIXME, should update from partial messages
    if (!status) {
	debug("setMediaStatus: status = %s", status);
	return;
    }
    this.mediaStatus = status;
    debug("setMediaStatus -> %s", status.playerState);
}

Chromecast.prototype._connect = function() {
    let self = this;

    return new Promise(function(resolve, reject) {
	if (!self.options.address) {
	    return reject(new Response(400, "no proper chromecast address passed."));
	}

	var client = new Client();
	client.connect(self.options.address, function() {
	    self.client = client;
	    resolve();
	});

	var onStatus = function(status) {
	    self._setStatus(status);
	};
	var onError = function(err) {
	    console.log("Error: %s", err);
	    client.removeListener("error", onError);
	    reject(err);
	};
	client.on("error", onError);
	client.on("status", onStatus);
    });
}

Chromecast.prototype._launch = function() {
    let self = this;

    return new Promise(function(resolve, reject) {
	debug("launch");
	self.client.launch(DefaultMediaReceiver, function(err, app) {
	    if (err) { return reject(err); }
	    var onStatus = function(status) {
		self._setMediaStatus(status);
            };
	    var onClose = function() {
		app.removeListener('status', onStatus);
		app.removeListener('error', onError);
		self._setMediaStatus(null);
	    };
	    var onError = function(err) {
		console.log("Error: %s", err);
		app.removeListener('status', onStatus);
		app.removeListener('close', onClose);
		reject(err);
	    };
	    app.on("status", onStatus);
	    app.once('close', onClose);
	    app.once("error", onError);
	    self.app = app;
	    resolve();
	});
    });
}

Chromecast.prototype._load = function() {
    let self = this;

    return new Promise(function(resolve, reject) {
	debug("load");
	self.app.load(self.options.media, { autoplay: true }, function(err, status) {
	    if (err) { return reject(err); }
	    self.mediaStatus = status;
	    resolve();
	});
    });
}

Chromecast.prototype._getStatus = function() {
    let self = this;

    return new Promise(function(resolve, reject) {
	debug("getStatus");
	self.client.getStatus(function(err, status) {
	    if (err) { return reject(err); }
	    self._setStatus(status);
	    resolve(status);
	});
    });
}

Chromecast.prototype._getSessions = function() {
    let self = this;

    return new Promise(function(resolve, reject) {
	debug("getSessions");
	self.client.getSessions(function(err, sessions) {
	    if (err) { return reject(err); }
	    resolve(sessions);
	});
    });
}

Chromecast.prototype._stop = function() {
    let self = this;
    return new Promise(function(resolve, reject) {
	debug("stop");
	self.client.stop(self.app, function (err, result) {
	    self.mediaStatus = null;
	    if (err) { return reject(err); }
	    resolve();
	});
    });
}

Chromecast.prototype._setVolume = function() {
    let self = this;
    return new Promise(function(resolve, reject) {
	debug("setVolume", self.options.volume);
	self.client.setVolume(self.options.volume, function (err, result) {
	    if (err) { return reject(err); }
	    resolve();
	});
    });
}

Chromecast.prototype._join = function(session) {
    let self = this;
    return new Promise(function(resolve, reject) {
	debug("join");
	// FIXME? DefaultMediaReceiver is actually too specialized, it could be some other app
	self.client.join(session, DefaultMediaReceiver, function(err, app) {
	    if (err) { return reject(err); }

	    var onStatus = function(status) {
		self._setMediaStatus(status);
            };
	    var onClose = function() {
		app.removeListener('status', onStatus);
		app.removeListener('error', onError);
		self._setMediaStatus(null);
	    };
	    var onError = function(err) {
		console.log("Error: %s", err);
		app.removeListener('status', onStatus);
		app.removeListener('close', onClose);
		reject(err);
	    };
	    app.on("status", onStatus);
	    app.once('close', onClose);
	    app.once("error", onError);
	    self.app = app;
	    resolve();
	});
    })  // need to get media status to establish mediaSessionId, which is required for sending
        // commands
	.then(() => self._getMediaStatus())
}

Chromecast.prototype._getMediaStatus = function() {
    let self = this;
    return new Promise(function(resolve, reject) {
	debug("getMediaStatus");
	self.app.getStatus(function(err, status) {
	    if (err) { return reject(err); }
	    self._setMediaStatus(status);
	    resolve(status);
	});
    });
}

Chromecast.prototype._waitForPlayerState = function(playerState) {
    let self = this;
    return new Promise(function(resolve, reject) {
	if (self.mediaStatus.playerState == playerState) {
	    resolve();
	}
	var onTimeout = function () {
	    reject(new Response(500, "timed out while waiting for playerState"));
	};
	var timeout = setTimeout(onTimeout, 5000);
	var onStatus = function (status) {
	    if (status.playerState == playerState) {
		clearTimeout(timeout);
		self.app.removeListener("status", onStatus);
		self.app.removeListener("close", onClose);
		resolve();
	    } // FIXME, probably should do a timeout, too
	};
	var onClose = function() {
	    self.app.removeListener("status", onStatus);
	    clearTimeout(timeout);
	}
	self.app.on("status", onStatus);
	self.app.once("close", onClose);
    });
}

Chromecast.prototype._pause = function() {
    let self = this;
    return new Promise(function(resolve, reject) {
	debug("pause")
	self.app.pause(function (err, status) {
	    if (err) { return reject(err); }
	    self._setMediaStatus(status);
	    resolve();
	});
    })
}

Chromecast.prototype._play = function() {
    let self = this;
    return new Promise(function(resolve, reject) {
	debug("play");
	self.app.play(function (err, result) {
	    if (err) { return reject(err); }
	    resolve();
	});
    });
}

Chromecast.prototype._queueUpdate = function() {
    let self = this;
    return new Promise(function(resolve, reject) {
	debug("queueUpdate", self.options.update);
	// this really happens, at least on GooglePlayMusic -- queueUpdate request does not get
	// acknowledged (though it's executed).
	var onTimeout = function () {
	    reject(new Response(202, "timed out while waiting for queueUpdate"));
	};
	var timeout = setTimeout(onTimeout, 5000);
	self.app.queueUpdate(self.options.update.items, self.options.update.options, function (err, result) {
	    clearTimeout(timeout);
	    if (err) { return reject(err); }
	    resolve();
	});
    });
}

Chromecast.prototype._sendResponse = function() {
    var msg = {};
    msg.response = this.response;
    msg.status = this.status;
    msg.mediaStatus = this.mediaStatus;
    debug("sendResponse:", msg);
    this.res.send(msg);
    if (this.app) { this.app.close(); }
    if (this.client) { this.client.close(); }
}

Chromecast.prototype._sendErrorResponse = function(err) {
    if (err instanceof Response) {
	var msg = {};
	msg.response = err.response;
	msg.status = this.status;
	msg.mediaStatus = this.mediaStatus;
	debug("sendErrorResponse:", err.code, msg);
	this.res.status(err.code).send(msg);
    } else {
	debug("SendErrorResponse:", err);
	this.res.status(500).send(err + "\n");
    }
    if (this.app) { this.app.close(); }
    if (this.client) { this.client.close(); }
}

function attach(ctx) {
    return Promise.resolve()
	.then(() => { return ctx._connect(); })
    // getting the receiver status is somewhat redundant, as we're going to
    // get it again in getSessions(), but there it won't be passed back to us,
    // and because it's not a broadcast, it'll not register in the onStatus handler,
    // either.
	.then(() => ctx._getStatus() )
	.then(() => ctx._getSessions() )
	.then((sessions) => {
	    if (!sessions || !sessions[0]) {
		return Promise.reject(new Response(202, "No running app to attach."));
	    }
	    if (!sessions[0].namespaces.find(x => x.name === "urn:x-cast:com.google.cast.media")) {
		return Promise.reject(new Response(202, "Running app does not support MediaController"));
	    };
	    return ctx._join(sessions[0]);
	})
};

// REST service

let express = require('express');
let bodyParser = require('body-parser');

let app = express();
app.use(bodyParser.json({type: 'application/json'}));

app.post('/playMedia', function (req, res) {
    let ctx = new Chromecast(req, res);
    if (!req.body.media) {
	return ctx._sendErrorResponse(new Response(400, '"media" parameter missing.\n'));
    }
    ctx.options.media = req.body.media;

    Promise.resolve()
	.then(() => ctx._connect() )
	.then(() => ctx._launch() )
	.then(() => ctx._load() )
	.then(() => ctx._waitForPlayerState("PLAYING") )
	.then(() => ctx._sendResponse() )
	.catch((err) => ctx._sendErrorResponse(err) );
});

app.post('/stop', function (req, res) {
    let ctx = new Chromecast(req, res);

    attach(ctx)
    	.then(() => ctx._stop() )
	.then(() => ctx._sendResponse() )
	.catch((err) => ctx._sendErrorResponse(err) );
});

app.post('/pause', function (req, res) {
    let ctx = new Chromecast(req, res);

    attach(ctx)
    	.then(() => ctx._pause() )
	.then(() => ctx._waitForPlayerState("PAUSED") )
	.then(() => ctx._sendResponse() )
	.catch((err) => ctx._sendErrorResponse(err) );
});

app.post('/play', function (req, res) {
    let ctx = new Chromecast(req, res);

    attach(ctx)
    	.then(() => ctx._play() )
	.then(() => ctx._waitForPlayerState("PLAYING") )
	.then(() => ctx._sendResponse() )
	.catch((err) => ctx._sendErrorResponse(err) );
});

app.post('/volume', function (req, res) {
    let ctx = new Chromecast(req, res);
    ctx.options.volume = req.body.volume;

    Promise.resolve()
	.then(() => ctx._connect() )
	.then(() => ctx._setVolume() )
	.then(() => ctx._sendResponse() )
	.catch((err) => ctx._sendErrorResponse(err) );
});

app.post('/queueUpdate', function (req, res) {
    let ctx = new Chromecast(req, res);
    ctx.options.update = req.body.update;

    attach(ctx)
	.then(() => { return ctx._queueUpdate(); })
	.then(() => { return ctx._sendResponse(); })
	.catch((err) => ctx._sendErrorResponse(err) );
});

app.post('/status', function (req, res) {
    let ctx = new Chromecast(req, res);

    attach(ctx)
	.then(() => { return ctx._sendResponse(); })
	.catch((err) => ctx._sendErrorResponse(err) );
});

if (module === require.main) {
    // start the server
    let server = app.listen(process.env.PORT || 8080, function () {
	let port = server.address().port;
	console.log('App listening on port %s', port);
    });
}

module.exports = app;
