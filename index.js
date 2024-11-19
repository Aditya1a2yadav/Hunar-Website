if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const passport = require('passport');
const flash = require('express-flash');
const session = require('express-session');
const methodOverride = require('method-override');
const mysql = require("mysql2");
const path=require('path');

const initializePassport = require('./passport-config');
initializePassport(passport);

// Database connection
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  database: "hunar",
  password: "password",
  multipleStatements: true,
});
connection.connect();
global.db = connection;

app.set('view-engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, "/public/css")));
app.use(express.static(path.join(__dirname, "/public/js")));
app.use(express.static(path.join(__dirname, "/public/stuffs")));

app.get('/', checkAuthenticated, (req, res) => {
  res.render('page1.ejs', { name: req.user.name });
});

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs');
});

app.post('/login', checkNotAuthenticated, (req, res, next) => {
  console.log('Login Form Data:', req.body);
  // Proceed to Passport authentication
  next();
}, passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));


// app.get('/register', checkNotAuthenticated, (req, res) => {
//   res.render('register.ejs');
// });

// app.post('/register', checkNotAuthenticated, async (req, res) => {
//   try {
//     const hashedPassword = await bcrypt.hash(req.body.password, 10);
    
//     // Insert new user into the database
//     const query = 'INSERT INTO admin (name, email, password) VALUES (?, ?, ?)';
//     db.query(query, [req.body.name, req.body.email, hashedPassword], (err) => {
//       if (err) {
//         console.error('Error inserting user into the database:', err);
//         return res.redirect('/register');
//       }
//       res.redirect('/login');
//     });
//   } catch (err) {
//     console.error('Error during registration:', err);
//     res.redirect('/register');
//   }
// });

app.delete('/logout', (req, res) => {
  req.logOut((err) => {
    if (err) {
      return next(err); // Handle the error if there's one
    }
    res.redirect('/login');
  });
});


function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  next();
}

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
