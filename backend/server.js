const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const app = express();
dotenv.config();
const PORT = process.env.PORT || 5000;


// Security headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS options
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  optionsSuccessStatus: 200,
  credentials: true
};
app.use(cors(corsOptions));

app.use(express.json());

// Session setup for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport Google OAuth strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
},
  function(accessToken, refreshToken, profile, done) {
    // Here you can save user info to DB if needed
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Google OAuth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication, redirect or respond
    res.redirect('/');
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// MySQL connection setup
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'civiceye'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.message);
  } else {
    console.log('Connected to MySQL database.');

    // Create users table
    db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL
      )`, (err) => {
      if (err) console.error('Error creating users table:', err.message);
    });

    // Create reports table
    db.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
      if (err) console.error('Error creating reports table:', err.message);
    });
  }
});

// Users endpoints
app.get('/api/users', (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(results);
    }
  });
});

app.post('/api/users', (req, res) => {
  let { username, email } = req.body;
  if (!username || !email) {
    return res.status(400).json({ error: 'Missing username or email' });
  }
  // Basic input sanitization
  username = username.replace(/[^a-zA-Z0-9_\-]/g, '');
  email = email.replace(/[^a-zA-Z0-9@._\-]/g, '');

  db.query('INSERT INTO users (username, email) VALUES (?, ?)', [username, email], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ id: result.insertId, username, email });
    }
  });
});

// Reports endpoints
app.get('/api/reports', (req, res) => {
  db.query('SELECT * FROM reports', (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(results);
    }
  });
});

app.post('/api/reports', (req, res) => {
  let { title, description } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'Missing title or description' });
  }
  // Basic input sanitization
  title = title.replace(/[^a-zA-Z0-9_\- ]/g, '');
  description = description.replace(/[^a-zA-Z0-9_\- .,!?]/g, '');

  db.query('INSERT INTO reports (title, description) VALUES (?, ?)', [title, description], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(201).json({ id: result.insertId, title, description });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});