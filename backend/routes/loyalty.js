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

// GET /api/loyalty/customer/:phone/dish-progress
router.get("/customer/:phone/dish-progress", async (req, res) => {
  try {
    const { phone } = req.params;
    if (!phone || phone.trim() === "") {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input("Phone", sql.NVarChar(50), phone.trim())
      .query(`
        SELECT 
          r.RuleId,
          r.RequiredBills,
          pd.Name AS PurchaseDishName,
          rd.Name AS RewardDishName,
          ISNULL(s.CurrentCount, 0) AS CurrentCount,
          ISNULL(s.RewardsAvailable, 0) AS RewardsAvailable,
          ISNULL(s.RewardCyclesCompleted, 0) AS RewardCyclesCompleted,
          r.IsActive AS RuleActive,
          c.Name AS CampaignName
        FROM LoyaltyRule r
        INNER JOIN LoyaltyCampaign c ON r.CampaignId = c.CampaignId
        LEFT JOIN DishMaster pd ON r.PurchaseDishId = pd.DishId
        LEFT JOIN DishMaster rd ON r.RewardDishId = rd.DishId
        LEFT JOIN LoyaltyCustomer cust ON cust.Phone = @Phone
        LEFT JOIN CustomerDishLoyaltyState s ON s.RuleId = r.RuleId AND s.CustomerId = cust.LoyaltyCustomerId
        WHERE 
          (r.IsActive = 1 AND c.IsActive = 1 AND GETDATE() BETWEEN c.StartDate AND c.EndDate)
          OR (s.CustomerId IS NOT NULL AND (s.CurrentCount > 0 OR s.RewardsAvailable > 0))
      `);

    res.json(result.recordset || []);
  } catch (err) {
    console.error("[LOYALTY DISH PROGRESS ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/loyalty/calculate-bill-rewards
router.post("/calculate-bill-rewards", async (req, res) => {
  try {
    const { phone, items } = req.body;
    if (!phone || !Array.isArray(items)) {
      return res.status(400).json({ error: "Missing required fields (phone, items)" });
    }

    const pool = await poolPromise;
    const cleanPhone = phone.trim();

    // 1. Get customer
    const custRes = await pool.request()
      .input("Phone", sql.NVarChar(50), cleanPhone)
      .query("SELECT LoyaltyCustomerId FROM LoyaltyCustomer WHERE Phone = @Phone");

    if (custRes.recordset.length === 0) {
      return res.json({ success: true, items: items, appliedRewards: [], totalDiscount: 0 });
    }

    const customerId = custRes.recordset[0].LoyaltyCustomerId;

    // 2. Fetch active rules
    const rulesRes = await pool.request().query(`
      SELECT r.RuleId, r.PurchaseDishId, r.RewardDishId, r.RequiredBills
      FROM LoyaltyRule r
      INNER JOIN LoyaltyCampaign c ON r.CampaignId = c.CampaignId
      WHERE r.IsActive = 1 AND c.IsActive = 1
        AND GETDATE() BETWEEN c.StartDate AND c.EndDate
    `);

    const activeRules = rulesRes.recordset || [];
    if (activeRules.length === 0) {
      return res.json({ success: true, items: items, appliedRewards: [], totalDiscount: 0 });
    }

    // 3. Fetch customer loyalty state for active rules
    const stateRes = await pool.request()
      .input("CustomerId", sql.UniqueIdentifier, customerId)
      .query(`
        SELECT RuleId, RewardsAvailable FROM CustomerDishLoyaltyState
        WHERE CustomerId = @CustomerId AND RewardsAvailable > 0
      `);

    const userStates = stateRes.recordset || [];
    const ruleRewardsMap = {}; // ruleId -> RewardsAvailable
    userStates.forEach(s => {
      ruleRewardsMap[s.RuleId] = s.RewardsAvailable;
    });

    const updatedItems = items.map(item => ({ ...item }));
    const appliedRewards = [];
    let totalDiscount = 0;

    // Evaluate each active rule
    for (const rule of activeRules) {
      const rewardsAvail = ruleRewardsMap[rule.RuleId] || 0;
      if (rewardsAvail <= 0) continue;

      let rewardsApplied = 0;
      for (let i = 0; i < updatedItems.length; i++) {
        const item = updatedItems[i];
        if (String(item.DishId).toLowerCase() === String(rule.RewardDishId).toLowerCase() && !item.isDishReward) {
          const qtyToFree = Math.min(item.Qty || 1, rewardsAvail - rewardsApplied);
          if (qtyToFree > 0) {
            const originalPrice = parseFloat(item.Price || 0);
            
            if (item.Qty > qtyToFree) {
              // Split line item
              item.Qty = item.Qty - qtyToFree;

              updatedItems.push({
                ...item,
                Qty: qtyToFree,
                Price: 0,
                originalPrice: originalPrice,
                isDishReward: true,
                rewardRuleId: rule.RuleId,
                rewardDishId: rule.RewardDishId
              });
            } else {
              item.originalPrice = originalPrice;
              item.Price = 0;
              item.isDishReward = true;
              item.rewardRuleId = rule.RuleId;
              item.rewardDishId = rule.RewardDishId;
            }

            rewardsApplied += qtyToFree;
            totalDiscount += (originalPrice) * qtyToFree;
            appliedRewards.push({
              ruleId: rule.RuleId,
              rewardDishId: rule.RewardDishId,
              qty: qtyToFree
            });

            if (rewardsApplied >= rewardsAvail) {
              break;
            }
          }
        }
      }
    }

    res.json({
      success: true,
      items: updatedItems,
      appliedRewards,
      totalDiscount
    });
  } catch (err) {
    console.error("[LOYALTY CALCULATE REWARDS ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/loyalty/log-visit
router.post("/log-visit", async (req, res) => {
  try {
    const { phone, name, settlementId, billNo, items } = req.body;

    if (!phone || !settlementId || !billNo) {
      return res.status(400).json({ error: "Missing required fields (phone, settlementId, billNo)" });
    }

    const pool = await poolPromise;
    const cleanPhone = phone.trim();
    const cleanBillNo = billNo.trim();

    // 1. Idempotency Check
    const dupCheck = await pool.request()
      .input("SettlementId", sql.UniqueIdentifier, settlementId)
      .query("SELECT LoyaltyVisitId FROM LoyaltyVisit WHERE SettlementId = @SettlementId");

    if (dupCheck.recordset.length > 0) {
      return res.json({ success: true, message: "Visit already logged for this settlement", duplicate: true });
    }

    // 2. Split Bill Check: Deduplicate by Base Bill No
    const baseBillNo = cleanBillNo.split("-S")[0];
    const splitCheck = await pool.request()
      .input("BaseBillNo", sql.NVarChar(50), baseBillNo)
      .query("SELECT LoyaltyVisitId FROM LoyaltyVisit WHERE BillNo LIKE @BaseBillNo + '%'");

    const isSplitDuplicate = splitCheck.recordset.length > 0;

    // Use a transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 3. Upsert LoyaltyCustomer (Global Visits)
      let customerId;
      const custRes = await transaction.request()
        .input("Phone", sql.NVarChar(50), cleanPhone)
        .query("SELECT LoyaltyCustomerId, VisitCount, TotalVisits, RewardPending FROM LoyaltyCustomer WITH (UPDLOCK) WHERE Phone = @Phone");

      if (custRes.recordset.length === 0) {
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
          let newVisitCount = cust.VisitCount + 1;
          let newTotalVisits = cust.TotalVisits + 1;
          let newRewardPending = cust.RewardPending;

          if (newVisitCount === 9) {
            newRewardPending = 1;
          } else if (newVisitCount >= 10) {
            newVisitCount = 1;
            newRewardPending = 0;
          }

          await transaction.request()
            .input("LoyaltyCustomerId", sql.UniqueIdentifier, customerId)
            .input("Name", sql.NVarChar(255), name ? name.trim() : null)
            .input("VisitCount", sql.Int, newVisitCount)
            .input("TotalVisits", sql.Int, newTotalVisits)
            .input("RewardPending", sql.Bit, newRewardPending)
            .query(`
              UPDATE LoyaltyCustomer 
              SET VisitCount = @VisitCount,
                  TotalVisits = @TotalVisits,
                  RewardPending = @RewardPending,
                  LastVisitDate = GETDATE(),
                  Name = CASE WHEN Name IS NULL OR Name = '' THEN ISNULL(@Name, Name) ELSE Name END
              WHERE LoyaltyCustomerId = @LoyaltyCustomerId
            `);
        }
      }

      // 4. Fetch all active loyalty rules
      const activeRulesRes = await transaction.request().query(`
        SELECT r.RuleId, r.PurchaseDishId, r.RewardDishId, r.RequiredBills
        FROM LoyaltyRule r
        INNER JOIN LoyaltyCampaign c ON r.CampaignId = c.CampaignId
        WHERE r.IsActive = 1 AND c.IsActive = 1
          AND GETDATE() BETWEEN c.StartDate AND c.EndDate
      `);
      const activeRules = activeRulesRes.recordset || [];

      // 5. Process Dish-Specific Loyalty Progress & Redemptions
      if (Array.isArray(items) && activeRules.length > 0) {
        // Separate items by unique DishId
        const uniquePurchaseIds = [...new Set(items.filter(i => !i.isDishReward).map(i => String(i.DishId).toLowerCase()))];
        const redeemedRewards = items.filter(i => i.isDishReward);

        // A. Process Paid Items (Increments)
        for (const rule of activeRules) {
          const rulePurchaseIdLower = String(rule.PurchaseDishId).toLowerCase();
          
          if (uniquePurchaseIds.includes(rulePurchaseIdLower) && !isSplitDuplicate) {
            // Get current state
            const stateRes = await transaction.request()
              .input("CustomerId", sql.UniqueIdentifier, customerId)
              .input("RuleId", sql.UniqueIdentifier, rule.RuleId)
              .query(`
                SELECT CurrentCount, RewardsAvailable FROM CustomerDishLoyaltyState WITH (UPDLOCK)
                WHERE CustomerId = @CustomerId AND RuleId = @RuleId
              `);

            if (stateRes.recordset.length === 0) {
              // Insert initial state
              const initialCount = 1;
              const rewardsEarned = initialCount >= rule.RequiredBills ? 1 : 0;
              const finalCount = rewardsEarned > 0 ? 0 : initialCount;

              await transaction.request()
                .input("CustomerId", sql.UniqueIdentifier, customerId)
                .input("RuleId", sql.UniqueIdentifier, rule.RuleId)
                .input("Count", sql.Int, finalCount)
                .input("Rewards", sql.Int, rewardsEarned)
                .query(`
                  INSERT INTO CustomerDishLoyaltyState (CustomerId, RuleId, CurrentCount, RewardsAvailable, RewardCyclesCompleted)
                  VALUES (@CustomerId, @RuleId, @Count, @Rewards, 0)
                `);
            } else {
              // Update state
              const state = stateRes.recordset[0];
              const newCount = state.CurrentCount + 1;
              const rewardsEarned = newCount >= rule.RequiredBills ? 1 : 0;
              const finalCount = rewardsEarned > 0 ? 0 : newCount;
              const finalRewards = state.RewardsAvailable + rewardsEarned;

              await transaction.request()
                .input("CustomerId", sql.UniqueIdentifier, customerId)
                .input("RuleId", sql.UniqueIdentifier, rule.RuleId)
                .input("Count", sql.Int, finalCount)
                .input("Rewards", sql.Int, finalRewards)
                .query(`
                  UPDATE CustomerDishLoyaltyState
                  SET CurrentCount = @Count,
                      RewardsAvailable = @Rewards,
                      ModifiedOn = GETDATE()
                  WHERE CustomerId = @CustomerId AND RuleId = @RuleId
                `);
            }
          }
        }

        // B. Process Redemptions (Decrements)
        for (const redeemed of redeemedRewards) {
          const ruleId = redeemed.rewardRuleId;
          const qty = redeemed.Qty || 1;

          if (ruleId) {
            await transaction.request()
              .input("CustomerId", sql.UniqueIdentifier, customerId)
              .input("RuleId", sql.UniqueIdentifier, ruleId)
              .input("Qty", sql.Int, qty)
              .query(`
                UPDATE CustomerDishLoyaltyState
                SET RewardsAvailable = CASE WHEN RewardsAvailable >= @Qty THEN RewardsAvailable - @Qty ELSE 0 END,
                    RewardCyclesCompleted = RewardCyclesCompleted + @Qty,
                    ModifiedOn = GETDATE()
                WHERE CustomerId = @CustomerId AND RuleId = @RuleId
              `);
          }
        }
      }

      // 6. Insert LoyaltyVisit Log
      // Extract if any dish reward was visit
      const firstDishReward = Array.isArray(items) ? items.find(i => i.isDishReward) : null;

      await transaction.request()
        .input("LoyaltyCustomerId", sql.UniqueIdentifier, customerId)
        .input("SettlementId", sql.UniqueIdentifier, settlementId)
        .input("BillNo", sql.NVarChar(50), cleanBillNo)
        .input("IsRewardVisit", sql.Bit, firstDishReward ? 1 : 0)
        .input("RewardDishId", sql.UniqueIdentifier, firstDishReward ? firstDishReward.rewardDishId : null)
        .query(`
          INSERT INTO LoyaltyVisit (LoyaltyVisitId, LoyaltyCustomerId, SettlementId, BillNo, IsRewardVisit, RewardDishId)
          VALUES (NEWID(), @LoyaltyCustomerId, @SettlementId, @BillNo, @IsRewardVisit, @RewardDishId)
        `);

      await transaction.commit();
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

// DELETE /api/loyalty/customer/:phone
router.delete("/customer/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    if (!phone || phone.trim() === "") {
      return res.status(400).json({ success: false, error: "Phone number is required" });
    }
    const pool = await poolPromise;
    
    const custRes = await pool.request()
      .input("Phone", sql.NVarChar(50), phone.trim())
      .query("SELECT LoyaltyCustomerId FROM LoyaltyCustomer WHERE Phone = @Phone");
       
    if (custRes.recordset.length === 0) {
      return res.status(404).json({ success: false, error: "Loyalty customer not found" });
    }
    
    const customerId = custRes.recordset[0].LoyaltyCustomerId;
    
    await pool.request()
      .input("LoyaltyCustomerId", sql.UniqueIdentifier, customerId)
      .query("DELETE FROM LoyaltyVisit WHERE LoyaltyCustomerId = @LoyaltyCustomerId");
       
    await pool.request()
      .input("Phone", sql.NVarChar(50), phone.trim())
      .query("DELETE FROM LoyaltyCustomer WHERE Phone = @Phone");
       
    res.json({ success: true, message: "Loyalty visitor deleted successfully" });
  } catch (err) {
    console.error("[LOYALTY DELETE ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/loyalty/customer/:phone/orders
router.get("/customer/:phone/orders", async (req, res) => {
  try {
    const { phone } = req.params;
    if (!phone || phone.trim() === "") {
      return res.status(400).json({ error: "Phone number is required" });
    }
    const pool = await poolPromise;
    const phoneValue = phone.trim();
    
    const query = `
      SELECT 
        sh.SettlementID,
        sh.BillNo,
        sh.CreatedOn AS OrderDateTime,
        sh.SysAmount AS TotalAmount,
        sh.IsCancelled,
        (
          SELECT TOP 1 UPPER(LTRIM(RTRIM(sts.PayMode)))
          FROM SettlementTotalSales sts
          WHERE sts.SettlementID = sh.SettlementID
        ) AS PayMode
      FROM SettlementHeader sh
      WHERE sh.MobileNo = @Phone OR REPLACE(sh.MobileNo, ' ', '') = REPLACE(@Phone, ' ', '')
      ORDER BY sh.CreatedOn DESC
    `;
    
    const result = await pool.request()
      .input("Phone", sql.NVarChar(50), phoneValue)
      .query(query);
       
    res.json(result.recordset);
  } catch (err) {
    console.error("[LOYALTY CUSTOMER ORDERS ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/loyalty/order/:settlementId
router.get("/order/:settlementId", async (req, res) => {
  try {
    const { settlementId } = req.params;
    if (!settlementId || settlementId.trim() === "") {
      return res.status(400).json({ error: "Settlement ID is required" });
    }
    const pool = await poolPromise;
    
    const headerRes = await pool.request()
      .input("Id", sql.UniqueIdentifier, settlementId)
      .query(`
        SELECT 
          sh.SettlementID,
          sh.BillNo,
          sh.CreatedOn AS OrderDateTime,
          sh.SysAmount AS TotalAmount,
          sh.SubTotal,
          sh.TotalTax,
          sh.DiscountAmount,
          sh.ServiceCharge,
          sh.IsCancelled
        FROM SettlementHeader sh
        WHERE sh.SettlementID = @Id
      `);
      
    if (headerRes.recordset.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    const itemsRes = await pool.request()
      .input("Id", sql.UniqueIdentifier, settlementId)
      .query(`
        SELECT 
          DishId,
          DishName,
          Qty,
          Price,
          DiscountAmount
        FROM SettlementItemDetail
        WHERE SettlementID = @Id
      `);
      
    res.json({
      order: headerRes.recordset[0],
      items: itemsRes.recordset || []
    });
  } catch (err) {
    console.error("[LOYALTY ORDER DETAILS ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
