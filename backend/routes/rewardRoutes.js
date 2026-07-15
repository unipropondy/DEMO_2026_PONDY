const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { poolPromise } = require("../config/db");
const { authenticateToken } = require("../middleware/auth");

// All routes require auth
router.use(authenticateToken);

// ─────────────────────────────────────────────
// REWARD MASTER CONFIG
// ─────────────────────────────────────────────

/**
 * GET /api/rewards/master
 * Returns the active reward earn rule (spend amount → credit amount)
 */
router.get("/master", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT TOP 1 Id, SpendAmount, CreditAmount, IsActive, Description, CreatedOn, ModifiedOn
      FROM RewardMaster
      WHERE IsActive = 1
      ORDER BY Id DESC
    `);
    if (result.recordset.length === 0) {
      return res.json({ SpendAmount: 100, CreditAmount: 1, IsActive: 1, Description: "Default" });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error("[Rewards] GET master error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/rewards/master
 * Update the active reward earn rule
 * Body: { spendAmount, creditAmount, description }
 */
router.put("/master", async (req, res) => {
  try {
    const pool = await poolPromise;
    const { spendAmount, creditAmount, description } = req.body;
    const spend = parseFloat(spendAmount);
    const credit = parseFloat(creditAmount);

    if (!spend || spend <= 0 || !credit || credit <= 0) {
      return res.status(400).json({ error: "spendAmount and creditAmount must be positive numbers" });
    }

    const existing = await pool.request().query(`SELECT TOP 1 Id FROM RewardMaster ORDER BY Id DESC`);
    if (existing.recordset.length > 0) {
      await pool.request()
        .input("SpendAmount", sql.Decimal(18, 2), spend)
        .input("CreditAmount", sql.Decimal(18, 4), credit)
        .input("Description", sql.NVarChar(255), description || null)
        .input("Id", sql.Int, existing.recordset[0].Id)
        .query(`
          UPDATE RewardMaster 
          SET SpendAmount = @SpendAmount, CreditAmount = @CreditAmount, Description = @Description, ModifiedOn = GETDATE()
          WHERE Id = @Id
        `);
    } else {
      await pool.request()
        .input("SpendAmount", sql.Decimal(18, 2), spend)
        .input("CreditAmount", sql.Decimal(18, 4), credit)
        .input("Description", sql.NVarChar(255), description || null)
        .query(`
          INSERT INTO RewardMaster (SpendAmount, CreditAmount, IsActive, Description)
          VALUES (@SpendAmount, @CreditAmount, 1, @Description)
        `);
    }
    res.json({ success: true, spendAmount: spend, creditAmount: credit });
  } catch (err) {
    console.error("[Rewards] PUT master error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// MEMBER SEARCH (by name or phone)
// ─────────────────────────────────────────────

/**
 * GET /api/rewards/members/search?q=
 * Search MemberMaster by name or phone for reward lookup
 */
router.get("/members/search", async (req, res) => {
  try {
    const pool = await poolPromise;
    const { q } = req.query;
    const query = `%${(q || "").trim()}%`;
    const result = await pool.request()
      .input("query", sql.NVarChar, query)
      .query(`
        SELECT 
          MemberId, Name, Phone, 
          ISNULL(RewardCredit, 0) AS RewardCredit,
          AvailableCredit,
          CreditLimit, CurrentBalance, IsActive
        FROM MemberMaster
        WHERE IsActive = 1
          AND (Name LIKE @query OR Phone LIKE @query)
        ORDER BY Name
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error("[Rewards] member search error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rewards/members/check-phone?phone=
 * Check if a phone number is already registered (for duplicate prevention)
 */
router.get("/members/check-phone", async (req, res) => {
  try {
    const pool = await poolPromise;
    const { phone, excludeId } = req.query;
    if (!phone || !phone.trim()) {
      return res.json({ exists: false });
    }
    const req2 = pool.request().input("Phone", sql.NVarChar(50), phone.trim());
    let query = `SELECT MemberId, Name FROM MemberMaster WHERE Phone = @Phone AND IsActive = 1`;
    if (excludeId) {
      req2.input("ExcludeId", sql.UniqueIdentifier, excludeId);
      query += ` AND MemberId <> @ExcludeId`;
    }
    const result = await req2.query(query);
    if (result.recordset.length > 0) {
      res.json({ exists: true, member: result.recordset[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error("[Rewards] check-phone error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// REWARD HISTORY & BALANCE
// ─────────────────────────────────────────────

/**
 * GET /api/rewards/history/:memberId
 * Get reward transaction history for a member
 */
router.get("/history/:memberId", async (req, res) => {
  try {
    const pool = await poolPromise;
    const { memberId } = req.params;
    const result = await pool.request()
      .input("MemberId", sql.UniqueIdentifier, memberId)
      .query(`
        SELECT TOP 50
          rpd.Id, rpd.BillNo, rpd.BillAmount, rpd.PointsEarned, rpd.PointsUsed,
          rpd.TransType, rpd.PayMode, rpd.Remarks, rpd.CreatedOn,
          mm.Name, mm.Phone
        FROM RewardPointDetails rpd
        INNER JOIN MemberMaster mm ON rpd.MemberId = mm.MemberId
        WHERE rpd.MemberId = @MemberId
        ORDER BY rpd.CreatedOn DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error("[Rewards] history error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rewards/balance/:memberId
 * Get member's current reward wallet balance
 */
router.get("/balance/:memberId", async (req, res) => {
  try {
    const pool = await poolPromise;
    const { memberId } = req.params;
    const result = await pool.request()
      .input("MemberId", sql.UniqueIdentifier, memberId)
      .query(`
        SELECT 
          MemberId, Name, Phone,
          ISNULL(RewardCredit, 0) AS RewardCredit,
          AvailableCredit,
          CreditLimit, CurrentBalance
        FROM MemberMaster
        WHERE MemberId = @MemberId
      `);
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error("[Rewards] balance error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// REWARD POINTS CALCULATOR (util for frontend preview)
// ─────────────────────────────────────────────

/**
 * GET /api/rewards/calculate?amount=
 * Calculate reward credit for a given bill amount using active rule
 */
router.get("/calculate", async (req, res) => {
  try {
    const pool = await poolPromise;
    const amount = parseFloat(req.query.amount) || 0;
    const ruleRes = await pool.request().query(`
      SELECT TOP 1 SpendAmount, CreditAmount FROM RewardMaster WHERE IsActive = 1 ORDER BY Id DESC
    `);
    if (ruleRes.recordset.length === 0 || amount <= 0) {
      return res.json({ creditEarned: 0, rule: null });
    }
    const rule = ruleRes.recordset[0];
    const creditEarned = (amount / rule.SpendAmount) * rule.CreditAmount;
    res.json({
      creditEarned: Math.round(creditEarned * 10000) / 10000, // 4 decimal precision
      rule: { SpendAmount: rule.SpendAmount, CreditAmount: rule.CreditAmount }
    });
  } catch (err) {
    console.error("[Rewards] calculate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
