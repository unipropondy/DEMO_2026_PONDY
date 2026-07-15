const sql = require("mssql");
const { poolPromise } = require("../config/db");

async function test() {
  try {
    const pool = await poolPromise;
    console.log("Connected to DB.");
    
    // Find Azmi
    const res = await pool.request().query("SELECT MemberId, Name, RewardCredit FROM MemberMaster WHERE Name LIKE '%Azmi%'");
    console.log("Azmi records:", res.recordset);
    
    if (res.recordset.length > 0) {
      const member = res.recordset[0];
      const memberId = member.MemberId;
      console.log(`Deducting 0.10 from memberId ${memberId}`);
      
      const updateRes = await pool.request()
        .input("NewCredit", sql.Decimal(18, 4), 0.0)
        .input("MemberId", sql.UniqueIdentifier, memberId)
        .query(`
          UPDATE MemberMaster
          SET RewardCredit = @NewCredit, ModifiedDate = GETDATE()
          WHERE MemberId = @MemberId
        `);
      console.log("Update result:", updateRes);
      
      const res2 = await pool.request().query("SELECT MemberId, Name, RewardCredit FROM MemberMaster WHERE Name LIKE '%Azmi%'");
      console.log("Updated Azmi record:", res2.recordset);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit();
  }
}

test();
