const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { stringify } = require("csv-stringify/sync");

const app = express();
const db = new sqlite3.Database("payouts.db");

const API_SECRET = "change-moi-en-vrai-secret";

app.post("/api/payout-request", express.json(), (req, res) => {
  const secret = req.headers["x-api-secret"];

  if (secret !== API_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { robloxUserId, username, amount, reason } = req.body;
  const robux = Number(amount);

  if (!robloxUserId || !Number.isInteger(robux) || robux <= 0 || robux > 10000) {
    return res.status(400).json({ error: "Invalid payout request" });
  }

  db.run(
    `INSERT INTO payouts (robloxUserId, username, amount, reason)
     VALUES (?, ?, ?, ?)`,
    [robloxUserId, username, robux, reason || "Roblox request"],
    function () {
      res.json({
        success: true,
        payoutId: this.lastID,
        status: "draft"
      });
    }
  );
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      robloxUserId TEXT NOT NULL,
      username TEXT,
      amount INTEGER NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'draft',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

app.get("/", (req, res) => {
  db.all("SELECT * FROM payouts ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).send("DB error");

    res.send(`
      <h1>Roblox Payout Manager</h1>

      <form method="POST" action="/payouts">
        <input name="robloxUserId" placeholder="Roblox User ID" required />
        <input name="username" placeholder="Username" />
        <input name="amount" type="number" placeholder="Robux" required />
        <input name="reason" placeholder="Raison" />
        <button>Ajouter</button>
      </form>

      <hr />

      <a href="/export.csv">Exporter CSV</a>

      <table border="1" cellpadding="8">
        <tr>
          <th>ID</th>
          <th>UserId</th>
          <th>Username</th>
          <th>Montant</th>
          <th>Raison</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
        ${rows.map(row => `
          <tr>
            <td>${row.id}</td>
            <td>${row.robloxUserId}</td>
            <td>${row.username || ""}</td>
            <td>${row.amount}</td>
            <td>${row.reason || ""}</td>
            <td>${row.status}</td>
            <td>
              <form method="POST" action="/payouts/${row.id}/approve" style="display:inline">
                <button>Valider</button>
              </form>
              <form method="POST" action="/payouts/${row.id}/paid" style="display:inline">
                <button>Marquer payé</button>
              </form>
            </td>
          </tr>
        `).join("")}
      </table>
    `);
  });
});

app.post("/payouts", (req, res) => {
  const { robloxUserId, username, amount, reason } = req.body;

  const robux = Number(amount);
  if (!Number.isInteger(robux) || robux <= 0) {
    return res.status(400).send("Montant invalide");
  }

  db.run(
    `INSERT INTO payouts (robloxUserId, username, amount, reason)
     VALUES (?, ?, ?, ?)`,
    [robloxUserId, username, robux, reason],
    () => res.redirect("/")
  );
});

app.post("/payouts/:id/approve", (req, res) => {
  db.run(
    `UPDATE payouts SET status = 'approved' WHERE id = ? AND status = 'draft'`,
    [req.params.id],
    () => res.redirect("/")
  );
});

app.post("/payouts/:id/paid", (req, res) => {
  db.run(
    `UPDATE payouts SET status = 'paid' WHERE id = ? AND status = 'approved'`,
    [req.params.id],
    () => res.redirect("/")
  );
});

app.get("/export.csv", (req, res) => {
  db.all(
    `SELECT robloxUserId, username, amount, reason
     FROM payouts
     WHERE status = 'approved'`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send("DB error");

      const csv = stringify(rows, {
        header: true,
        columns: ["robloxUserId", "username", "amount", "reason"]
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=payouts.csv");
      res.send(csv);
    }
  );
});

app.listen(3000, () => {
  console.log("Payout Manager lancé sur http://localhost:3000");
});
