import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(process.cwd(), "data.json");

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to load/save data
async function loadData() {
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    // Initial data structure
    return {
      users: [
        {
          id: "admin-001",
          username: "admin",
          fullName: "System Administrator",
          password: "admin",
          role: "ADMIN",
          status: "APPROVED",
          requestedAt: new Date().toISOString()
        }
      ],
      materials: [],
      schemes: [],
      overseers: [],
      panchayats: [],
      beneficiaries: [],
      transactions: []
    };
  }
}

async function saveData(data: any) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// API Routes
app.get("/api/data", async (req, res) => {
  const data = await loadData();
  res.json(data);
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  console.log(`Login attempt: ${username}`);
  const data = await loadData();
  const user = data.users.find((u: any) => 
    u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );

  if (user) {
    if (user.status === 'APPROVED') {
      console.log(`Login success: ${username}`);
      res.json({ success: true, user });
    } else {
      console.log(`Login blocked (status ${user.status}): ${username}`);
      res.status(403).json({ success: false, error: `Account status: ${user.status}. Please wait for admin approval.` });
    }
  } else {
    console.log(`Login failed: ${username}`);
    res.status(401).json({ success: false, error: "Invalid username or password. Check credentials and CAPS lock." });
  }
});

app.post("/api/register", async (req, res) => {
  const newUser = req.body;
  const data = await loadData();
  
  if (data.users.find((u: any) => u.username.toLowerCase() === newUser.username.toLowerCase())) {
    return res.status(400).json({ success: false, error: "Username already exists" });
  }

  data.users.push({
    ...newUser,
    id: Math.random().toString(36).substring(2) + Date.now().toString(36),
    status: 'PENDING',
    role: 'USER',
    requestedAt: new Date().toISOString()
  });
  
  await saveData(data);
  res.json({ success: true });
});

// Generic CRUD endpoints
app.post("/api/:collection", async (req, res) => {
  const { collection } = req.params;
  const item = req.body;
  const data = await loadData();
  
  if (!data[collection]) data[collection] = [];
  
  const index = data[collection].findIndex((i: any) => i.id === item.id);
  if (index >= 0) {
    data[collection][index] = item;
  } else {
    data[collection].push(item);
  }
  
  await saveData(data);
  res.json({ success: true });
});

app.patch("/api/:collection/:id", async (req, res) => {
  const { collection, id } = req.params;
  const updates = req.body;
  const data = await loadData();
  
  const index = data[collection].findIndex((i: any) => i.id === id);
  if (index >= 0) {
    data[collection][index] = { ...data[collection][index], ...updates };
    await saveData(data);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: "Not found" });
  }
});

app.delete("/api/:collection/:id", async (req, res) => {
  const { collection, id } = req.params;
  const data = await loadData();
  
  data[collection] = data[collection].filter((i: any) => i.id !== id);
  await saveData(data);
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
