const https = require('https');
const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const GoogleSearch = require('google-search');
const googleSearch = new GoogleSearch({
  key: 'AIzaSyBW8_MwN13m9BSXBDhqMkQwUf5er-DiAF4',
  cx: '000797132421860451117:gm8c__fvxi0'
});

function createLatestDocument() {
  let latest = [];
  let json = {latest}
  db.collection('latest_collection').insertOne(json, function(err, res) {
      if (err) { console.log(err);
      } else {
        console.log("Created 'latest' document.");
        startListening()
      }
  });
}

function startListening() {
  let listener = app.listen(process.env.PORT || 3000, function () { // Starts server on PORT environment variable, or 3000 if no variable is provided.
    console.log('Good to go! Node listening on port ' + listener.address().port + '.');
  });
}

let db;
MongoClient.connect('mongodb://'+process.env.USER+':'+process.env.PASS+'@'+process.env.HOST+':'+process.env.DB_PORT+'/'+process.env.DB, function(err, client) {
  if (err) console.log(err);
  console.log('Connected to database.');
  db = client.db('image_search_latest_database');
  db.listCollections({ name: 'latest_collection' }).toArray(function(err, collectionInfo) {
      if (err) console.log(err);
      if (collectionInfo[0]) {
        console.log("'latest_collection exists.'");
        db.collection('latest_collection').findOne({latest: {$exists:true}}, function(err, result) {
          if (err) { console.log(err);
            } else if (result === null) {
              console.log("'latest' document does not exist...");
              createLatestDocument();
            } else {
              console.log("'latest' document exists.")
              startListening()
            }
          });
      } else {
        console.log("'latest_collection' does not exist...");
        db.createCollection('latest_collection', function(err, result) {
          if (err) { console.log('err');
          } else {
            console.log("Created 'latest_collection'.");
            console.log("'latest' document does not exist...");
            createLatestDocument()
            }
        });
      }
  });
});

app.use(express.static('public')); // Serves static files in the public directory.
app.get('/favicon.ico', function(req, res) { // Ignore request for favicon.
  res.status(204);
});

app.get('', function(req, res) { // Serves an index.html with description and usage examples.
  res.sendFile(__dirname + '/views/index.html');
});

app.use('/latest', function(req, res) {
  db.collection('latest_collection').findOne({ latest: {$exists:true} }, function (err, result) {
    if (err) { console.log(err);
    } else {
      let latest = result.latest;
      res.json(latest);
    }
  });
});

app.use('/', function(req, res) { // Handles search queries.
  let query = req.path.substr(1); // Query portion of URL (without leading forward slash or parameters).
  let offset = req.query.offset;
  // Google CSE limits searches to 100 results. Additionally, the offset plus the number of results cannot be greater than 100.
  // Since we always return 10 results, offset cannot be greater than 91.
  if (offset < 1 || offset > 91) {                 
    res.json({"Error:": "Invalid offset value. Valid values are positive integers from 1 to 91."});
  } else {
    googleSearch.build({q: query, start: offset ? offset : "1", num: "10", searchType: "image"}, function(err, result) {
      if (err) { console.log(err);
      } else {
        if (result.error) { res.json({"Google Search Engine Error:": result.error.errors});
        } else {
          // Respond with required properties.
          let json = [];
          let items = result.items;
          for (var i = 0, len = items.length; i < len; i++) {
          let object = {
            "image-url": items[i].link,
            "alt-text": items[i].title,
            "page-url": items[i].image.contextLink
          };
            json.push(object);
          }
          res.json(json);
        } 
      }
    });
  }
    
    // Save query in recent searches database.
  db.collection('latest_collection').findOne({ latest: {$exists:true} }, function (err, result) {
    if (err) { console.log(err);
      } else {
        let latest = result.latest;
        latest.unshift({"search": "localhost:3000/" + req.originalUrl.substr(1), "when": new Date()});
        if (latest.length > 10) {
          latest.splice(-1, 1);
        }
        db.collection('latest_collection').update({latest: {$exists:true}}, {latest: latest}, function(err, result) {
          if (err) console.log(err);
        });
      }
  });
});
