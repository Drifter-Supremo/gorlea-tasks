const functions = require("firebase-functions");

// A simple function that returns a message
exports.hello = functions.https.onRequest((req, res) => {
  res.status(200).send({
    message: "Hello from Firebase Functions!",
    timestamp: new Date().toISOString()
  });
});
