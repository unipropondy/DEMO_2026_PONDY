const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/db');

// Middleware to authenticate the print bridge requests
const authenticateBridge = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const storeId = req.headers['x-store-id'] || req.query.storeId || req.body.storeId;

  const expectedToken = process.env.BRIDGE_TOKEN || 'unipro-pos-bridge-token-2026';

  if (!token || token !== expectedToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Bridge Token' });
  }

  if (!storeId) {
    return res.status(400).json({ success: false, error: 'Bad Request: Missing Store ID' });
  }

  req.storeId = storeId;
  next();
};

// 1. POST /api/print-jobs/auth - Verify connection on bridge startup
router.post('/auth', authenticateBridge, (req, res) => {
  res.json({ success: true, message: 'Authenticated successfully', storeId: req.storeId });
});

// 2. GET /api/print-jobs/pending - Fetch pending jobs for the store
router.get('/pending', authenticateBridge, async (req, res) => {
  const pool = getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    
    // Select pending jobs
    const selectReq = new sql.Request(transaction);
    const result = await selectReq
      .input('StoreId', sql.NVarChar(50), req.storeId)
      .query(`
        SELECT JobId, StoreId, PrinterName, PrinterIp, PrinterPort, Content, Status, Attempts
        FROM PrintJobQueue
        WHERE StoreId = @StoreId AND Status = 'PENDING'
        ORDER BY CreatedOn ASC
      `);

    const jobs = result.recordset || [];

    if (jobs.length > 0) {
      // Mark them as PROCESSING
      const jobIds = jobs.map(j => `'${j.JobId}'`).join(',');
      const updateReq = new sql.Request(transaction);
      await updateReq.query(`
        UPDATE PrintJobQueue
        SET Status = 'PROCESSING', ProcessedOn = GETDATE(), Attempts = Attempts + 1
        WHERE JobId IN (${jobIds})
      `);
    }

    await transaction.commit();
    res.json({ success: true, data: jobs });

  } catch (err) {
    try { await transaction.rollback(); } catch (e) {}
    console.error('Error fetching pending print jobs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/print-jobs/:jobId/complete - Mark job as completed
router.post('/:jobId/complete', authenticateBridge, async (req, res) => {
  try {
    const { jobId } = req.params;
    const pool = getPool();
    
    await pool.request()
      .input('JobId', sql.UniqueIdentifier, jobId)
      .query(`
        UPDATE PrintJobQueue
        SET Status = 'COMPLETED', CompletedOn = GETDATE()
        WHERE JobId = @JobId
      `);

    res.json({ success: true, message: 'Job completed successfully' });
  } catch (err) {
    console.error('Error completing print job:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST /api/print-jobs/:jobId/failed - Mark job as failed
router.post('/:jobId/failed', authenticateBridge, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { errorMessage } = req.body;
    const pool = getPool();

    await pool.request()
      .input('JobId', sql.UniqueIdentifier, jobId)
      .input('ErrorMessage', sql.NVarChar(sql.MAX), errorMessage || 'Unknown Error')
      .query(`
        UPDATE PrintJobQueue
        SET Status = 'FAILED', ErrorMessage = @ErrorMessage, CompletedOn = GETDATE()
        WHERE JobId = @JobId
      `);

    res.json({ success: true, message: 'Job failure recorded' });
  } catch (err) {
    console.error('Error recording print job failure:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
