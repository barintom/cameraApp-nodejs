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


/// ------------ SOCKETS.IO ---------------
///WebSocket -- requires /bin/www modification
var io = socketio();
app.io = io;
io.on('connection', function (socket) {
    console.log('user socket created');
});
/// --------- MONGODB / Mongoose ---------
var url = 'mongodb://via:via@ds047114.mongolab.com:47114/via';
var mongoose = require('mongoose');
var connection = mongoose.connect(url).conn;
var Contact = mongoose.model('Contact', new mongoose.Schema({ name: String, age: Number, gender: String, photo:  mongoose.Schema.ObjectId }));

app.use(logger('dev'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, 'public')));


/// ---- Display HTML page for image capturing ------
app.get('/capture', function (req, res) {
    res.sendFile(path.join(__dirname + '/capture.html'));
});

/// ---- Delete contact ------
app.delete('/contact/:id', function (req, res) {
    var id = req.params.id;
    Contact.find({ _id: id}).remove(function onRemoved(err, removed) {
        if (removed) {
            res.status = 204 //Deleted no content back
        } else if (err) {
            res.status = 500 //Probably internal error
            res.write(JSON.stringify({ status: 'ERROR', message: err }));
        }
        console.log('err',err,'removed',removed==null);
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
            })
        } else {
            res.end();
        }
        
    });
});
/// ---------- Store contact to MongoDB--------------
app.post('/contact',bodyParser.raw(), function (req, res) {
    var form = new multiparty.Form();

    form.parse(req, function (err, fields, files) {
        if (!fields.file || fields.file.length == 0) {
            res.status = 400 //Probably missing data
            res.send(JSON.stringify({ status: 'ERROR', message: 'Missing file' }));
            return;
        }
        var data = fields.file[0].replace(/^data:image\/png;base64,/, ""); //Get image
        var params =  URL.parse('?'+fields.data[0],true); //Reconstruct JSON
        console.log(params);
        var binaryData = new Buffer(data, 'base64');
        contacts.storeImage(mongoose, binaryData,'photo.png','image/x-png', function stored(id) { 
            var contact = new Contact(params.query);
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
});

/*
    contacts.storeImage(mongoose, binaryData,'img.png','image/x-png', function stored(id) {
            console.log('stored with id',id);
        });
        */
/// ---------- Recognize image content --------------
app.post('/recognize', function (req, res) {
    //FIXME: Avoid fixed url in code
    var url = '/fc/faces/detect.json?api_key=2663a40451a043cc8bd3216c5e81c683'
        + '&api_secret=6e171bf1146443caa44bc2dbcaf95a51&attributes=age,gender';

    var form = new multiparty.Form();
    form.parse(req, function (err, fields, files) {
        var data = fields.imageFile[0].replace(/^data:image\/png;base64,/, "");
        var binaryData = new Buffer(data, 'base64');
        //FIXME: Skip persistance   
        fs.writeFile(__dirname + '/img.png', binaryData, 'binary', function (err) {
            contacts.recognizeImage('api.skybiometry.com', url,  fs.createReadStream(__dirname + '/img.png'), function attributes(att) {
            res.send(JSON.stringify(att));
            //FIXME: This of course have nothing to do here.
            fs.unlink(__dirname + '/img.png');
        });
        });
    });
});

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