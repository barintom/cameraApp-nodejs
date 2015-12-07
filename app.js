var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var FormData = require('form-data');
var multiparty = require('multiparty');
var fs = require('fs');

var app = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
//app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//app.use('/', routes);
//app.use('/capture', capture);

app.get('/capture', function (req, res) {
    res.sendFile(path.join(__dirname + '/capture.html'));
});

app.get('/list', function(req,res) {
   res.sendFile(path.join(__dirname + 'list.html')); 
});


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
    res.write('Page not found');
     res.end();
});

// error handlers
app.use(function (err, req, res) {
    res.status(err.status || 500);
     res.write('error:'+err.message);
     res.end();
 });


module.exports = app;