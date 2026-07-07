const { poolPromise } = require("../config/db.js");

async function run() {
  try {
    const pool = await poolPromise;
    const res = await pool.request().query("SELECT TOP 5 DishId, Name, IsDiscountAllowed FROM DishMaster");
    console.log("DishMaster records:", res.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
