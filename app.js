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

// Google Cast

function Chromecast(req, res) {
    this.req = req;
    this.res = res;
    this.options = {};
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
	debug("connect");
	debug("Request headers: ", self.req.headers);
	debug("Request body:", self.req.body);

	let body = self.req.body;
	if (!body) { return reject(new Error("POST body missing.")); }
	
	let address = {};
	
	if (!body.host) { return reject(new Error("'host' parameter missing.")); }
	address.host = body.host;

	if (body.port) { address.port = body.port; }

	var client = new Client();
	client.connect(address, function() {
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
	    app.on('status', onStatus);
	    self.app = app;
	    resolve();
	});
    });
}

Chromecast.prototype._load = function() {
    let self = this;

    return new Promise(function(resolve, reject) {
	debug("load");
	let body = self.req.body;

	if (!body.media) { return reject(new Error('"media" parameter missing.\n')); }

	self.app.load(body.media, { autoplay: true }, function(err, status) {
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
	    resolve();
	});
    });
}

Chromecast.prototype._getSessions = function() {
    let self = this;

    return new Promise(function(resolve, reject) {
	debug("getSessions");
	self.client.getSessions(function(err, sessions) {
	    if (err) { return reject(err); }
	    if (sessions.length) {
		self.session = sessions[0];
	    } else {
		// FIXME, not really an error, unless trying to join
		//return reject(new Error("no session to join"));
	    }
	    resolve();
	});
    });
}

Chromecast.prototype._stop = function() {
    let self = this;

    return new Promise(function(resolve, reject) {
	debug("stop");
	if (!self.app) { return resolve(); }
	self.client.stop(self.app, function (err, result) {
	    debug("stopped", result);
	    self.mediaStatus = null;
	    if (err) { return reject(err); }
	    resolve();
	});
    });
}

Chromecast.prototype._join = function() {
    let self = this;
    return new Promise(function(resolve, reject) {
	debug("join");
	// FIXME? DefaultMediaReceiver is actually too specialized, it could be some other app
	self.client.join(self.session, DefaultMediaReceiver, function(err, app) {
	    if (err) { return reject(err); }
	    var onStatus = function(status) {
		self._setMediaStatus(status);
            };
	    app.on('status', onStatus);
	    self.app = app;
	    resolve();
	});
    });
}

Chromecast.prototype._getMediaStatus = function() {
    let self = this;

    return new Promise(function(resolve, reject) {
	debug("getMediaStatus");
	self.app.getStatus(function(err, status) {
	    if (err) { return reject(err); }
	    // not sure why this needs to be called here,
	    // mostly the onStatus handler seems to take care of it
	    self._setMediaStatus(status);
	    resolve();
	});
    });
}

Chromecast.prototype._pause = function() {
    let self = this;
    return new Promise(function(resolve, reject) {
	debug("pause")
	if (!self.app || !self.app.media.currentSession) {
	    return resolve();
	}
	self.app.pause(function (err, result) {
	    if (err) { return reject(err); }
	    resolve();
	});
    });
}

Chromecast.prototype._play = function() {
    let self = this;
    return new Promise(function(resolve, reject) {
	debug("play");
	if (!self.app || !self.app.media.currentSession) {
	    return resolve();
	}
	self.app.play(function (err, result) {
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

Chromecast.prototype._queueUpdate = function() {
    let self = this;
    return new Promise(function(resolve, reject) {
	debug("queueUpdate", self.options.update);
	if (!self.app || !self.app.media.currentSession) {
	    return resolve();
	}
	self.app.queueUpdate(self.options.update.items, self.options.update.options,
				function (err, result) {
	    if (err) { return reject(err); }
	    resolve();
	});
    });
}

Chromecast.prototype._sendResponse = function() {
    var msg = {};
    if (this.status) { msg.status = this.status };
    if (this.mediaStatus) { msg.mediaStatus = this.mediaStatus };
    debug("sendResponse:", msg);
    this.res.send(msg);
    this.client.close();
}

Chromecast.prototype._sendErrorResponse = function(code, err) {
    debug("SendErrorResponse(%d): %s", code, err);
    this.res.status(code).send(err + "\n");
    if (this.client) {
	this.client.close();
    }
}

function attach(ctx) {
    return Promise.resolve()
	.then(() => { return ctx._connect(); })
	.then(() => { return ctx._getStatus(); })
	.then(() => { return ctx._getSessions(); })
	.then(() => {
	    if (ctx.session) {
		return Promise.resolve()
		    .then(() => { return ctx._join(); })
		    .then(() => { return ctx._getMediaStatus(); });
	    } else {
		return Promise.resolve();
	    }
	})
};

// REST service

let express = require('express');
let bodyParser = require('body-parser');

let app = express();
app.use(bodyParser.json({type: 'application/json'}));

app.post('/playMedia', function (req, res) {
    let ctx = new Chromecast(req, res);

    Promise.resolve()
	.then(() => { return ctx._connect() })
	.then(() => { return ctx._launch() })
	.then(() => { return ctx._load() })
	.then(() => {
	    return new Promise(function(resolve, reject) {
		var onStatus = function (status) {
		    if (status.playerState == "PLAYING") {
			ctx._sendResponse();
			resolve();
		    } // FIXME, probably should do a timeout if we aren't getting "PLAYING"
		};
		ctx.app.on("status", onStatus);
	    });
	})
	.catch(function(err) {
	    ctx._sendErrorResponse(500, err);
	});
});

app.post('/stop', function (req, res) {
    let ctx = new Chromecast(req, res);

    attach(ctx)
    	.then(() => { return ctx._stop(); })
	.then(() => { return ctx._sendResponse(); })
	.catch(function(err) { 
	    ctx._sendErrorResponse(500, err);
	});
});

app.post('/pause', function (req, res) {
    let ctx = new Chromecast(req, res);

    attach(ctx)
	.then(() => { return ctx._pause(); })
	.then(() => { return ctx._sendResponse(); })
	.catch(function(err) { 
	    ctx._sendErrorResponse(500, err);
	});
});

app.post('/play', function (req, res) {
    let ctx = new Chromecast(req, res);

    attach(ctx)
	.then(() => { return ctx._play(); })
	.then(() => { return ctx._sendResponse(); })
	.catch(function(err) { 
	    ctx._sendErrorResponse(500, err);
	});
});

app.post('/volume', function (req, res) {
    let ctx = new Chromecast(req, res);
    ctx.options.volume = req.body.volume;

    Promise.resolve()
	.then(() => { return ctx._connect() })
	.then(() => { return ctx._setVolume(); })
	.then(() => { return ctx._sendResponse(); })
	.catch(function(err) { 
	    ctx._sendErrorResponse(500, err);
	});
});

app.post('/queueUpdate', function (req, res) {
    let ctx = new Chromecast(req, res);
    ctx.options.update = req.body.update;

    Promise.resolve()
	.then(() => { return ctx._connect() })
	.then(() => { return ctx._queueUpdate(); })
	.then(() => { return ctx._sendResponse(); })
	.catch(function(err) { 
	    ctx._sendErrorResponse(500, err);
	});
});

app.post('/status', function (req, res) {
    let ctx = new Chromecast(req, res);

    attach(ctx)
	.then(() => { return ctx._sendResponse(); })
	.catch(function(err) { 
	    ctx._sendErrorResponse(500, err);
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
