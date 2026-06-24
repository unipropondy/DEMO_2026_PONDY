const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
router.use(authenticateToken);
const sql = require("mssql");
const { poolPromise } = require("../config/db");

// GET /api/loyalty/search?q=query
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    const pool = await poolPromise;
    if (!q || q.trim() === "") {
      const result = await pool.request()
        .query(`
          SELECT TOP 20 Phone, Name, VisitCount, TotalVisits, RewardPending 
          FROM LoyaltyCustomer 
          ORDER BY LastVisitDate DESC, Name ASC
        `);
      return res.json(result.recordset);
    }
    const result = await pool.request()
      .input("Query", sql.NVarChar(50), `%${q.trim()}%`)
      .query(`
        SELECT TOP 10 Phone, Name, VisitCount, TotalVisits, RewardPending 
        FROM LoyaltyCustomer 
        WHERE Phone LIKE @Query OR Name LIKE @Query
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error("[LOYALTY SEARCH ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/loyalty/status/:phone
router.get("/status/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    if (!phone || phone.trim() === "") {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input("Phone", sql.NVarChar(50), phone.trim())
      .query(`
        SELECT LoyaltyCustomerId, Phone, Name, VisitCount, TotalVisits, RewardsEarned, RewardsRedeemed, RewardPending 
        FROM LoyaltyCustomer 
        WHERE Phone = @Phone
      `);

    if (result.recordset.length > 0) {
      return res.json({ success: true, exists: true, customer: result.recordset[0] });
    } else {
      // Return a virtual new guest customer
      return res.json({
        success: true,
        exists: false,
        customer: {
          LoyaltyCustomerId: null,
          Phone: phone.trim(),
          Name: "",
          VisitCount: 0,
          TotalVisits: 0,
          RewardsEarned: 0,
          RewardsRedeemed: 0,
          RewardPending: 0,
          isNew: true
        }
      });
    }
  } catch (err) {
    console.error("[LOYALTY STATUS ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/loyalty/log-visit
router.post("/log-visit", async (req, res) => {
  try {
    const { phone, name, settlementId, billNo, isRewardVisit, rewardDishId } = req.body;

    if (!phone || !settlementId || !billNo) {
      return res.status(400).json({ error: "Missing required fields (phone, settlementId, billNo)" });
    }

    const pool = await poolPromise;
    const cleanPhone = phone.trim();
    const cleanBillNo = billNo.trim();

    // 1. Idempotency Check: Check if SettlementId already has a logged visit
    const dupCheck = await pool.request()
      .input("SettlementId", sql.UniqueIdentifier, settlementId)
      .query("SELECT LoyaltyVisitId FROM LoyaltyVisit WHERE SettlementId = @SettlementId");

    if (dupCheck.recordset.length > 0) {
      console.log(`[Loyalty Log] Duplicate visit check: SettlementId ${settlementId} already logged.`);
      return res.json({ success: true, message: "Visit already logged for this settlement", duplicate: true });
    }

    // 2. Split Bill Check: Deduplicate by Base Bill No (e.g. "20260624-0001" from "20260624-0001-S1")
    const baseBillNo = cleanBillNo.split("-S")[0];
    const splitCheck = await pool.request()
      .input("BaseBillNo", sql.NVarChar(50), baseBillNo)
      .query("SELECT LoyaltyVisitId FROM LoyaltyVisit WHERE BillNo LIKE @BaseBillNo + '%'");

    const isSplitDuplicate = splitCheck.recordset.length > 0;

    // Use a transaction to update customer count and insert visit log
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 3. Upsert LoyaltyCustomer
      let customerId;
      const custRes = await transaction.request()
        .input("Phone", sql.NVarChar(50), cleanPhone)
        .query("SELECT LoyaltyCustomerId, VisitCount, TotalVisits, RewardPending FROM LoyaltyCustomer WITH (UPDLOCK) WHERE Phone = @Phone");

      if (custRes.recordset.length === 0) {
        // Customer does not exist, create new
        const insertCustRes = await transaction.request()
          .input("Phone", sql.NVarChar(50), cleanPhone)
          .input("Name", sql.NVarChar(255), name ? name.trim() : null)
          .input("VisitCount", sql.Int, isSplitDuplicate ? 0 : 1)
          .input("TotalVisits", sql.Int, isSplitDuplicate ? 0 : 1)
          .query(`
            DECLARE @newCustId UNIQUEIDENTIFIER = NEWID();
            INSERT INTO LoyaltyCustomer (LoyaltyCustomerId, Phone, Name, VisitCount, TotalVisits, LastVisitDate)
            VALUES (@newCustId, @Phone, @Name, @VisitCount, @TotalVisits, GETDATE());
            SELECT @newCustId AS LoyaltyCustomerId;
          `);
        customerId = insertCustRes.recordset[0].LoyaltyCustomerId;
      } else {
        const cust = custRes.recordset[0];
        customerId = cust.LoyaltyCustomerId;

        if (!isSplitDuplicate) {
          let newVisitCount = cust.VisitCount;
          let newTotalVisits = cust.TotalVisits + 1;
          let newRewardsEarned = 0;
          let newRewardsRedeemed = 0;
          let newRewardPending = cust.RewardPending;

          if (isRewardVisit) {
            // Cashier applied the free item reward
            newVisitCount = 0;
            newRewardsRedeemed = 1; // Increment count of redeemed rewards
            newRewardPending = 0;
          } else {
            newVisitCount = cust.VisitCount + 1;
            if (newVisitCount === 9) {
              // 9th visit completes the cycle, next checkout is eligible
              newRewardPending = 1;
              newRewardsEarned = 1;
            } else if (newVisitCount >= 10) {
              // Fallback safety: if they did not redeem but reached visit 10, rollover
              newVisitCount = 1;
              newRewardPending = 0;
            }
          }

          await transaction.request()
            .input("LoyaltyCustomerId", sql.UniqueIdentifier, customerId)
            .input("Name", sql.NVarChar(255), name ? name.trim() : null)
            .input("VisitCount", sql.Int, newVisitCount)
            .input("TotalVisits", sql.Int, newTotalVisits)
            .input("RewardsRedeemed", sql.Int, newRewardsRedeemed)
            .input("RewardsEarned", sql.Int, newRewardsEarned)
            .input("RewardPending", sql.Bit, newRewardPending)
            .query(`
              UPDATE LoyaltyCustomer 
              SET VisitCount = @VisitCount,
                  TotalVisits = @TotalVisits,
                  RewardsRedeemed = RewardsRedeemed + @RewardsRedeemed,
                  RewardsEarned = RewardsEarned + @RewardsEarned,
                  RewardPending = @RewardPending,
                  LastVisitDate = GETDATE(),
                  Name = CASE WHEN Name IS NULL OR Name = '' THEN ISNULL(@Name, Name) ELSE Name END
              WHERE LoyaltyCustomerId = @LoyaltyCustomerId
            `);
        }
      }

      // 4. Insert LoyaltyVisit Log
      await transaction.request()
        .input("LoyaltyCustomerId", sql.UniqueIdentifier, customerId)
        .input("SettlementId", sql.UniqueIdentifier, settlementId)
        .input("BillNo", sql.NVarChar(50), cleanBillNo)
        .input("IsRewardVisit", sql.Bit, isRewardVisit ? 1 : 0)
        .input("RewardDishId", sql.UniqueIdentifier, rewardDishId ? rewardDishId : null)
        .query(`
          INSERT INTO LoyaltyVisit (LoyaltyVisitId, LoyaltyCustomerId, SettlementId, BillNo, IsRewardVisit, RewardDishId)
          VALUES (NEWID(), @LoyaltyCustomerId, @SettlementId, @BillNo, @IsRewardVisit, @RewardDishId)
        `);

      await transaction.commit();
      console.log(`[Loyalty Log] Success logging visit: Phone=${cleanPhone}, BillNo=${cleanBillNo}, SplitDuplicate=${isSplitDuplicate}`);
      res.json({ success: true, splitDuplicate: isSplitDuplicate });
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (err) {
    console.error("[LOYALTY LOG VISIT ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/loyalty/register
// Registers a new loyalty customer (or returns existing) without a bill
router.post("/register", async (req, res) => {
  try {
    const { phone, name } = req.body;
    if (!phone || phone.trim() === "") {
      return res.status(400).json({ success: false, error: "Phone number is required" });
    }

    const pool = await poolPromise;
    const cleanPhone = phone.trim();

    // Check if already exists
    const existing = await pool.request()
      .input("Phone", sql.NVarChar(50), cleanPhone)
      .query("SELECT LoyaltyCustomerId, Phone, Name, VisitCount, TotalVisits, RewardsEarned, RewardsRedeemed, RewardPending FROM LoyaltyCustomer WHERE Phone = @Phone");

    if (existing.recordset.length > 0) {
      return res.json({ success: true, exists: true, customer: existing.recordset[0], message: "Customer already registered" });
    }

    // Insert new customer
    const insertRes = await pool.request()
      .input("Phone", sql.NVarChar(50), cleanPhone)
      .input("Name", sql.NVarChar(255), name ? name.trim() : null)
      .query(`
        DECLARE @newId UNIQUEIDENTIFIER = NEWID();
        INSERT INTO LoyaltyCustomer (LoyaltyCustomerId, Phone, Name, VisitCount, TotalVisits, LastVisitDate)
        VALUES (@newId, @Phone, @Name, 0, 0, GETDATE());
        SELECT @newId AS LoyaltyCustomerId;
      `);

    const newId = insertRes.recordset[0].LoyaltyCustomerId;

    const newCust = await pool.request()
      .input("LoyaltyCustomerId", sql.UniqueIdentifier, newId)
      .query("SELECT LoyaltyCustomerId, Phone, Name, VisitCount, TotalVisits, RewardsEarned, RewardsRedeemed, RewardPending FROM LoyaltyCustomer WHERE LoyaltyCustomerId = @LoyaltyCustomerId");

    return res.json({ success: true, exists: false, customer: newCust.recordset[0], message: "Customer registered successfully" });
  } catch (err) {
    console.error("[LOYALTY REGISTER ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
