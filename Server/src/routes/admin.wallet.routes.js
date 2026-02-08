const express = require('express');

const { getWalletSummary, addWalletCredits, listWalletTransactions } = require('../controllers/adminWallet.controller');

const router = express.Router();

router.get('/summary', getWalletSummary);
router.post('/credits', addWalletCredits);
router.get('/transactions', listWalletTransactions);

module.exports = router;
