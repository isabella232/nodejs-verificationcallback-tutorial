var express = require('express');        // call express
var bodyParser = require('body-parser');
var numbers = [];

//set content type to jason for all responses
function logResponseBody(req, res, next) {
  res.setHeader('Content-Type', 'application/json');
  next();
}


function lookUpNumber(number) {
  for (var p in numbers) {
    if (numbers[p] == number) {
      return true;
    }
  }
  return false;
}

function removeNumber(number) {
  for (var p in numbers) {
    if (numbers[p] == number) {
      numbers.splice(p, 1);
    }
  }
}

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logResponseBody);
var port = 8080;        // set our port
var router = express.Router();

router.post('/sinch', function (req, res) {
  //look the type of event VerificationRequestEvent or VerificationResultEvent
  if (req.body['event'] == 'VerificationRequestEvent') {
    if (lookUpNumber(req.body['identity']['endpoint'])) {
      res.json({ action: 'allow' });

    } else {
      res.json({ 'action': 'deny' });
    }
  }
  else if (req.body['event'] == 'VerificationResultEvent') {
    if (req.body['status'] == 'SUCCESSFUL') {
      //remove the number if it was SUCCESSFUL
      removeNumber(req.body['identity']['endpoint']);
      res.status(200);
      res.json();
    }
    else {
      //take some action in the app to let the user know it failed. 
    }
  }
});

router.post('/addnumber', function (req, res) {
  //your custom api security like an oath bearer token
  //in this tutorials we are going to save the numbers in memory, 
  //in production you prob want to either persist it or use a rediscache or similiar
  numbers.push(req.body['number'])
  res.json({ message: 'Ok' });
});


app.use('/', router);
app.listen(port);

module.exports = app;
