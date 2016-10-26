# Securing your Verifications when using Sinch

In this tutorial, we'll show you the different ways you can ensure that your app is secure and nobody is using your account for fraudulent verifications.

## Two different ways of securing your app
Sinch offers 2 ways to secure your app, the first one is the [Callback/webhook](https://www.sinch.com/docs/verification/rest/#verificationcallbackapi "CallbackAPI") way of securing it which we'll dive into today, and the other is Application Signed requests, but that's a post for another day.

### Webhooks
This is the recommended way of securing your verification. Using Sinch Verification we send two events to your back end (if configured), one when someone wants to create a verification and one when the client tried to authenticate.

We chose this approach for a couple of reasons, the first was to enable developers to easy try it out with no backend, the second was that we did not want to have the key and secret in-app, and Oauth seemed overcomplicated for a process that will most likely only occur once.

![](http://www.websequencediagrams.com/files/render?link=kIkrYWmlPWM80o2Hh8NS)


You can verify that the request is from us by signing the request you receive and comparing the hash https://www.sinch.com/using-rest/#Authorization, or if you prefer, ship a custom variable like your Token for your own api requests and validate that in the custom variables.

## Using node to respond to your callbacks
Let's set up a backend to allow or deny a verification attempt. Today we will use node, and create the requests using our [api explorer](https://www.sinch.com/dashboard/#/api) that you'll find in the dashboard. 
![](images/apiexplorer.png)

We're going to set up the node app with [express](http://expressjs.com/), which is an awesome framework for MVC patterns. 

- Create the app
```bash
npm init
```
Accept all defaults. 

```bash
npm install --save express body-parser
```

With basic wiring setup we can start writing some code. As I previously mentioned, when a verification reqeust is made you get that event posted to an endpoint. That will be a POST request and contain something like this:
```
{
    "id":"1234567890",
    "event": "VerificationRequestEvent",
    "method": "flashCall",
    "identity": { "type":"number", "endpoint":"+46700000000" },
    "price": { "amount": 0.005, "currencyId":"USD" } ,
	"custom":"your custom data, you can make json if you want"   
}
```

There are a few parameters here that I want to point out -- we need the event to know what kind of event is being sent to us and we need either the identity or enough custom data to inform us of whether the reqeusts should be allowed or denied.

Creaet a file named index.js and start hook express:

index.json
```
var express    = require('express');        // call express
var bodyParser = require('body-parser');

function logResponseBody(req, res, next) {
// intercept all requests and set response type to json, and log it for debug 
  res.setHeader('Content-Type', 'application/json');
  console.log(JSON.stringify(req.body, null, 2));
  next();
}

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logResponseBody);
var port = process.env.PORT || 8080;        // set our port
var router = express.Router();  

router.post('/sinch', function(req, res) {
    res.json({ message: 'Here we need to respond correct SVAML' });   
});
app.use('/api', router);
app.listen(port);
module.exports = app;
```

Using PostMan, you can post to the localhost:8080/sinch and see the message response, but that's not very exciting so here's what we want to do:

1. Create an endpoint that is secured with your own custom login token for users (i.e oauth2 or your custom auth scheme) where you add numbers you want to verify

2. Store in a database (in this tutorial I will just use in memory as an example)

3. A sinch webhook endpoint that will:

	a. Look up the number on initate request. Allow if it's a hit, otherwise deny.
	
	b. When a verification is successful, remove it from the list of numbers. 


### Endpoint to add numbers
Add a global varialbe to hold numbers:

```javascript
var numbers = [];
router.post('/addnumber', function (req, res) {
  //your custom api security like an oath bearer token
  //in this tutorials we are going to save the numbers in memory, 
  //in production you prob want to either persist it or use a rediscache or similiar
  numbers.push(req.body['number'])
  res.json({ message: 'Ok' });
});
```

The code above doesn't do anything fancy, just pushes a new number in to the array. We will use this in the webhook endpoint next.

### Responding to webhook events
Sinch posts every event to the same endpoint, so the first task is to detemine if the event is a Request or Result event. The requestEvent is triggered when someone starts a verification, the result event is triggered every time someone tries to verify a code.


```javascript
router.post('/sinch', function (req, res) {
  //look the type of event VerificationRequestEvent or VerificationResultEvent
  if (req.body['event'] == 'VerificationRequestEvent') {
  }
  else if (req.body['event'] == 'VerificationResultEvent') {
    }
});
```
Next, I will add implementation to handle the RequestEvent by checking if the number is in allowed number array. This is also where you can set the code and make some other changes to the Veriifcation requests. View the docs for more [details](http://sinch.com/docs/verificaiton/rest).
 
```javascript
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
  }
});
```
If the function lookUpNumber returns true, allow it, otherwise deny. This is a time when I really miss c# with its lambda! It'd be so nice to be able to query the array for the key instead of a custom function. But today we're working with node so let's implement the custom function.

```javascript
function lookUpNumber(number) {
  for (var p in numbers) {
    if (numbers[p] == number) {
      return true;
    }
  }
  return false;
}
```

That finishes off the implementation for the Request event, and next I want to handle the result event. Look at the result and if it's a success, remove it from the list (if it fails it should notify the client, but that's outside the scope of this tutorial)

In the if statement for "VerificationResultEvent" I added the following code:

```javascript
if (req.body['status'] == 'SUCCESSFUL') {
  //remove the number if it was SUCCESSFUL
  removeNumber(req.body['identity']['endpoint']);
  res.status(200); //Sinch realy dosent care if you reply but its a nice gesture to reply to us :D
  res.json();
}
else {
  //take some action in the app to let the user know it failed. 
}

```

And the function to search and remove an element in an array: 
```javascript
function removeNumber(number) {
  for (var p in numbers) {
    if (numbers[p] == number) {
      numbers.splice(p, 1);
    }
  }
}
```

<img src="http://i.giphy.com/DnBmSVtvu4FUI.gif">

Now I just need to test! To do that, I will use [ngrok](https://ngrok.com/ "ngrok"), , which if you havent set up, you'll want to. Check out my previous post about ngrok and why I love it: [insert link] 

Start up ngrok:

```bash
>ngrok http 8080
```
![](images/ngrok.png)

I will head over to my app in the dashboard and change the url to  the above url. 

 ![](images/seturl.png) 
 
Using the dev tools in the portal to hit my number again, and what happens?

![](images/ngrockfail.png)

Looks like I forgot to add my number to the list of allowed numbers to verify, so with Postman (another awesome tool) I quickly add my number to the list.

![](images/postmanaddnumber.png)
Ok, hit the number again and this time I get the expected allow!
![](images/ngrokallow.png)

# What's next?
In order to use our verificaiton SDK, next steps for a real app would be to add logging, support for more types of verificaitons, and of course persistence and real security on my add numbers end points.

Would you be interested in a complete backend or are you more interested in snippets like today or perhaps even shorter? Let me know in the comments or tweet me at @cjsinch!





