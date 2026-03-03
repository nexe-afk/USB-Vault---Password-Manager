import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("vault.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS vault (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site TEXT NOT NULL,
    username TEXT NOT NULL,
    encrypted_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/vault", (req, res) => {
    const rows = db.prepare("SELECT * FROM vault ORDER BY created_at DESC").all();
    res.json(rows);
  });

  app.post("/api/vault", (req, res) => {
    const { site, username, encrypted_data } = req.body;
    const info = db.prepare(
      "INSERT INTO vault (site, username, encrypted_data) VALUES (?, ?, ?)"
    ).run(site, username, encrypted_data);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/vault/:id", (req, res) => {
    db.prepare("DELETE FROM vault WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
