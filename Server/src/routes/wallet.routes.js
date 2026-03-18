const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { getWalletSummary, listWalletTransactions } = require('../controllers/wallet.controller');

const router = express.Router();

router.use(auth);

router.get('/', getWalletSummary);
router.get('/transactions', listWalletTransactions);

module.exports = router;
