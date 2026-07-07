const { poolPromise } = require("../config/db.js");

async function run() {
  try {
    const pool = await poolPromise;
    const res = await pool.request().query("SELECT DishId, Name, IsDiscountAllowed FROM DishMaster WHERE Name LIKE '%Coffee%' OR Name LIKE '%Milk%'");
    console.log("DishMaster records:", res.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
