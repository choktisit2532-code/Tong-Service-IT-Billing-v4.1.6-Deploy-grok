const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/async-handler');
const { monthSchema } = require('../validators/schemas');
const { getMonthlyReport, getAdvancedReports } = require('../services/report.service');

const router = express.Router();
router.use(authenticate);

router.get('/monthly', authorize('report.view'), validate(monthSchema, 'query'), asyncHandler(async (req, res) => {
    res.json(await getMonthlyReport(req.query.month));
}));

router.get('/advanced', authorize('report.view'), asyncHandler(async (req, res) => {
    res.json({ data: await getAdvancedReports(req.query) });
}));

module.exports = router;
