var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var FormData = require('form-data');
var multiparty = require('multiparty');
var http = require('http');
var util = require('util');



var routes = require('./routes/index');
var capture = require('./routes/capture');
var http = require('http');
var request = require('request');
var fs = require('fs');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
//app.use('/capture', capture);

app.get('/capture', function (req, res) {
    res.sendFile(path.join(__dirname + '/capture.html'));
});

app.get('capture')


app.post('/recognize', function (req, res) {
    //FIXME: Avoid fixed url in code
    var url = '/fc/faces/detect.json?api_key=2663a40451a043cc8bd3216c5e81c683'
        + '&api_secret=6e171bf1146443caa44bc2dbcaf95a51&attributes=age,gender';

    var form = new multiparty.Form();
    form.parse(req, function (err, fields, files) {
        var data = fields.imageFile[0].replace(/^data:image\/png;base64,/, "");
        var binaryData = new Buffer(data, 'base64').toString('binary');
        //FIXME: Skip persistance
        fs.writeFile(__dirname + '/img.png', binaryData, 'binary', function (err) {
            var form = new FormData(); //
            form.append('file.png', fs.createReadStream(__dirname + '/img.png'), { contentType: 'image/x-png' });
            //Submit request
            form.submit(
                {
                    host: 'api.skybiometry.com',
                    path: url,
                    headers: {
                        'Content-Type': 'multipart/mixed; boundary=' + form.getBoundary()
                    }
                }, function (err, r) {
                    r.on('data', function (data) {

                        var jsonObject = JSON.parse(data);
                        console.log(jsonObject);
                        var attributes = jsonObject.photos[0].tags[0].attributes;
                        console.log("age:" + attributes.age_est.value + ", gender:" + attributes.gender.value);
                        
                        res.write(JSON.stringify({age: attributes.age_est.value, gender: attributes.gender.value}));
                        res.end();
                    });
                });
        });
    });
    

});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
