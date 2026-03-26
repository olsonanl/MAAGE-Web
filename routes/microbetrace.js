var express = require('express');
var router = express.Router();
var path = require('path');

var microbeTracePath = path.join(__dirname, '../public/microbetrace');

// Redirect /microbetrace to /microbetrace/ for consistency
router.get('/', function (req, res) {
  // Serve MicrobeTrace index.html
  res.sendFile(path.join(microbeTracePath, 'index.html'));
});

// Serve static assets from /microbetrace/*
router.use('/', express.static(microbeTracePath));

// Fallback - serve index.html for SPA routing
router.get('*', function (req, res) {
  res.sendFile(path.join(microbeTracePath, 'index.html'));
});

module.exports = router;
