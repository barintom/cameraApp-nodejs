var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send(path.join(__dirname+'/index.html'));
});

module.exports = router;
