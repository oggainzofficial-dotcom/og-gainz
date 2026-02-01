const express = require('express');

const auth = require('../middlewares/auth.middleware');

const {
	listMyPauseSkipRequests,
	requestPause,
	requestWithdrawPause,
	requestSkipDelivery,
	withdrawPauseSkipRequest,
} = require('../controllers/subscription.controller');

const router = express.Router();

router.use(auth);

// Pause/Skip requests (user)
router.get('/requests', listMyPauseSkipRequests);
router.post('/pause-requests', requestPause);
router.post('/withdraw-pause-requests', requestWithdrawPause);
router.post('/skip-requests', requestSkipDelivery);
router.post('/requests/:requestId/withdraw', withdrawPauseSkipRequest);

module.exports = router;
