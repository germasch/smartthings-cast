# smartthings-cast

This is a node.js app designed to run in the cloud, serving as an intermediary between a SmartThings device handler and one or more Chromecasts / Google Homes on your home network. It talks to the Chromecast via a websocket on port 8009, which means that you have to make that port remotely reachable by setting up Port Forwarding in your router.

 