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

  const name = req.name;
  const query = 'SELECT * FROM modules';
  
  db.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching data from modules table:', err);
          return res.status(500).send('Internal Server Error');
      }
      // console.log(results[0]);
      
      // Pass the fetched data to the index.ejs template
      res.render("page1.ejs", { modules: results, name:name});
  });
});

app.get('/new_mod',checkAuthenticated,(req,res)=>{
  res.render("new_mod.ejs");
})

const { v4: uuidv4 } = require('uuid'); // Import UUID
const { name } = require('ejs');

app.post('/mod', checkAuthenticated, (req, res, next) => {
  // console.log("heello");
  try {
      const { module_name } = req.body;

      // Generate a unique UUID for mod_id
      const mod_id = uuidv4();

      // Insert into the modules table using db.query
      const q = 'INSERT INTO modules (mod_id, module) VALUES (?, ?)';
      const values = [mod_id, module_name];
      // console.log(module_name);

      db.query(q, values, (err, result) => {
          if (err) {
              console.error('Error adding module:', err);
              return next(err);
          }
          // Redirect to the homepage on successful insert
          res.redirect('/');
      });
  } catch (error) {
      console.error('Unexpected error:', error);
      next(error);
  }
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



app.delete('/logout', (req, res) => {
  req.logOut((err) => {
    if (err) {
      return next(err);
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
