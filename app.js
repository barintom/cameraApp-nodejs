var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var multiparty = require('multiparty');
var fs = require('fs');
var socketio = require("socket.io");
var app = express();
var util = require('util');
var URL = require('url');
var contacts = require('contacts'); /// --> Our custom module

/// ------------- BIO CONFIG --------------
var bioUrl = '/fc/faces/detect.json?api_key=2663a40451a043cc8bd3216c5e81c683&api_secret=6e171bf1146443caa44bc2dbcaf95a51&attributes=age,gender';
var bioServer = 'api.skybiometry.com';
/// --------- MONGODB / Mongoose ---------
var url = 'mongodb://via:via@ds047114.mongolab.com:47114/via';
var mongoose = require('mongoose');
var connection = mongoose.connect(url).conn;
var Contact = mongoose.model('Contact', new mongoose.Schema({ name: String, age: Number, gender: String, photo:  mongoose.Schema.ObjectId }));

app.use(logger('dev'));
app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

/// ------------ SOCKETS.IO ---------------
///WebSocket -- requires /bin/www modification
var io = socketio();
app.io = io;
io.on('connection', function (socket) {
    console.log('user socket created');
});

/// ---- Display HTML page for image capturing ------
app.get('/capture', function (req, res) {
    res.sendFile(path.join(__dirname + '/capture.html'));
});

/// --------------- Delete contact -----------------
app.delete('/contact/:id', function (req, res) {
    var id = req.params.id;
    Contact.find({ _id: id}).remove(function onRemoved(err, removed) {
        if (removed) {
            res.status = 204 //Deleted no content back
            //TODO: Remove image, skipping for demo
        } else if (err) {
            res.status = 500 //Probably internal error
            res.write(JSON.stringify({ status: 'ERROR', message: err }));
        }
        res.end();
        io.sockets.emit('change', { message: id + ' was deleted.' });
    });
});

/// ------------ Show list of contacts UI ---------------
app.get('/list', function (req, res) {
    res.sendFile(path.join(__dirname + '/list.html'));
});

/// ------------ Show list of contacts Data ---------------
app.get('/contacts', function (req, res) {
    Contact.find({},null,null, function results(err, docs) {
        res.send(docs);
    })
});

/// ---------- Get Photo from MongoDB--------------
app.get('/photo/:id', function (req, res) {
    var id = req.params.id;
    contacts.getImage(mongoose,id,function img(err, data) {
        if (data) {
            res.writeHead(200, {'Content-Type': 'image/x-png' });    
            data.on('data', function(chunk) {
                res.write(chunk,'binary');
            })
            data.on('end', function() {
                res.end();
            });
        } else {
            res.end();
        }
    });
});
/// ---------- Store contact to MongoDB--------------
app.post('/contact', function (req, res) {
    var meta = req.body.meta;
    var photo = req.body.photo;

    if (!photo || !photo.binary) {
        res.status = 400 //Probably missing data
        res.send(JSON.stringify({ status: 'ERROR', message: 'Missing file' }));
        return;
    }
    var data = cleanImage(photo.binary); //Get image
    var binaryData = new Buffer(data, 'base64');
    contacts.storeImage(mongoose, binaryData,'photo.png', photo.contentType, function stored(id) { 
        var contact = new Contact(meta);
        contact.photo = id;
        contact.save(function saveContact(err) {
            if (err) {
                console.log(err);
                res.status = 500 //Probably internal error
                res.write(JSON.stringify({ status: 'ERROR', message: err }));
            } else {
                console.log(contact);
                res.status = 201 //Created
                res.write(JSON.stringify({ status: 'DONE' }));
                io.sockets.emit('change', { message: contact.name + ' was added to collection.' });
            }
            res.end();
            });
        });
    });

/// ---------- Recognize image content --------------
app.post('/recognize', function (req, res) {
    var data = cleanImage(req.body.binary);
    var binaryData = new Buffer(data, 'base64');
    
    contacts.recognizeImage(bioServer, bioUrl, binaryData, function attributes(att) {
        res.send(JSON.stringify(att));
    });
});

function cleanImage(data) {
    return data.replace(/^data:image\/png;base64,/, "");
};

/// -------------- Error handling -------------------
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    res.write('Page not found');
    res.end();
});

// error handlers
app.use(function (err, req, res) {
    res.status(err.status || 500);
    res.write('error:' + err.message);
    res.end();
});


module.exports = app;