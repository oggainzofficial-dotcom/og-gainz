const express = require('express');

const { initiateCheckout, retryCheckout } = require('../controllers/checkout.controller');
const ensureNotBlocked = require('../middlewares/blocked.middleware');

const router = express.Router();

router.post('/initiate', ensureNotBlocked, initiateCheckout);
router.post('/retry', ensureNotBlocked, retryCheckout);
router.post('/verify', ensureNotBlocked, (req, res, next) => {
  // We will implement verifyCheckout in controller
  const { verifyCheckout } = require('../controllers/checkout.controller');
  return verifyCheckout(req, res, next);
});

module.exports = router;
