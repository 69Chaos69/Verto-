const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'estoquepro-secret-key-2026-secure';

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Database Initialization
const dbPath = path.join(__dirname, 'estoquepro.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_data (
    user_id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

console.log('📦 Banco de dados SQLite inicializado:', dbPath);

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Sessão expirada ou token inválido.' });
    }
    req.user = user;
    next();
  });
}

// ============ ROTAS DE AUTENTICAÇÃO ============

// Status / Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'EstoquePro Server',
    database: 'SQLite',
    time: new Date().toISOString()
  });
});

// Registrar Usuário (Sem verificação de e-mail)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'O nome de usuário deve ter pelo menos 3 caracteres.' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 4 caracteres.' });
    }

    // Verificar se já existe
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();

    // Inserir usuário
    const insertUser = db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)');
    insertUser.run(userId, cleanUsername, passwordHash, now);

    // Inicializar dados vazios
    const initialData = JSON.stringify({
      products: [],
      sales: [],
      rentalProducts: [],
      rentals: [],
      loans: []
    });
    db.prepare('INSERT INTO user_data (user_id, data_json, updated_at) VALUES (?, ?, ?)').run(userId, initialData, now);

    // Gerar token (válido por 365 dias)
    const token = jwt.sign({ id: userId, username: cleanUsername }, JWT_SECRET, { expiresIn: '365d' });

    res.status(201).json({
      message: 'Conta criada com sucesso!',
      token,
      user: { id: userId, username: cleanUsername }
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno ao criar conta.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);

    if (!user) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    // Gerar token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '365d' });

    res.json({
      message: 'Login realizado com sucesso!',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
});

// Validar Sessão Atual
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ============ ROTAS DE DADOS (SYNC) ============

// Obter todos os dados do usuário logado
app.get('/api/data', authenticateToken, (req, res) => {
  try {
    const row = db.prepare('SELECT data_json, updated_at FROM user_data WHERE user_id = ?').get(req.user.id);

    if (!row) {
      return res.json({
        products: [],
        sales: [],
        rentalProducts: [],
        rentals: [],
        loans: []
      });
    }

    const data = JSON.parse(row.data_json);
    res.json({
      ...data,
      serverUpdatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    res.status(500).json({ error: 'Erro ao carregar dados do servidor.' });
  }
});

// Sincronizar / Salvar todos os dados do usuário logado
app.post('/api/data/sync', authenticateToken, (req, res) => {
  try {
    const { products, sales, rentalProducts, rentals, loans } = req.body;

    const dataToSave = {
      products: Array.isArray(products) ? products : [],
      sales: Array.isArray(sales) ? sales : [],
      rentalProducts: Array.isArray(rentalProducts) ? rentalProducts : [],
      rentals: Array.isArray(rentals) ? rentals : [],
      loans: Array.isArray(loans) ? loans : []
    };

    const dataJson = JSON.stringify(dataToSave);
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO user_data (user_id, data_json, updated_at) 
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET 
        data_json = excluded.data_json,
        updated_at = excluded.updated_at
    `);

    stmt.run(req.user.id, dataJson, now);

    res.json({
      success: true,
      message: 'Dados sincronizados com sucesso no banco de dados!',
      serverUpdatedAt: now
    });
  } catch (error) {
    console.error('Erro ao sincronizar dados:', error);
    res.status(500).json({ error: 'Erro ao salvar dados no servidor.' });
  }
});

// Iniciar Servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===========================================`);
  console.log(`🚀 Servidor EstoquePro rodando na porta ${PORT}`);
  console.log(`📡 URL Local: http://localhost:${PORT}`);
  console.log(`===========================================`);
});
