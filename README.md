 # smartthings-cast

GPL-3.0 Licensed by Kai Germaschewski [@germaschewski](https://twitter.com/germaschewski)

## Overview
This is a node.js app designed to run in the cloud, serving as an intermediary between a SmartThings device handler and one or more Chromecasts / Google Homes on your home network. It talks to the Chromecast via a websocket on port 8009, which means that you have to make that port remotely reachable by setting up Port Forwarding in your router to each of your chromecasts.


## Quickstart - Local install
Clone the repository

```
git clone https://github.com/germasch/smartthings-cast.git
```

Change into the project's directory
```
cd smartthings-cast
```

Install dependencies

```
npm install
```

Run the app
```
node app.js
```

Stop the app
> Use Ctrl+C to stop the app and return to a command prompt


## Port Changes
This node app runs on port 8080 by default and that is configured on line 449 in app.js. As an example to change the default port from 8080 to port 30001 you can modify line 449 of app.js to read as follows. 
```
let server = app.listen(process.env.PORT || 30001, function () {
```
After making any changes to app.js the application must be restarted.


Alternatively, you can set an environment variable named PORT to whichever port you would like to use.
```
export PORT=30001
```
