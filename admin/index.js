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
const path = require('path');

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
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

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
    res.render("home.ejs", { modules: results, name: name });
  });
});

app.get('/new_mod', checkAuthenticated, (req, res) => {
  res.render("new_mod.ejs");
})

app.get('/mod/check_name', checkAuthenticated, (req, res) => {
  const { name } = req.query;

  const checkQuery = 'SELECT COUNT(*) as count FROM modules WHERE module = ?';
  db.query(checkQuery, [name], (err, results) => {
    if (err) {
      console.error('Error checking module name:', err);
      return res.status(500).send('Internal Server Error');
    }
    const count = results[0].count;
    res.json({ exists: count > 0 });
  });
});


const { v4: uuidv4 } = require('uuid'); // Import UUID
const { name } = require('ejs');

app.post('/mod', checkAuthenticated, (req, res, next) => {
  try {
    const { module_name } = req.body;

    // Generate a unique UUID for mod_id
    const mod_id = uuidv4();
    const insertModuleQuery = 'INSERT INTO modules (mod_id, module) VALUES (?, ?)';
    const insertValues = [mod_id, module_name];

    db.query(insertModuleQuery, insertValues, (err, result) => {
      if (err) {
        console.error('Error adding module:', err);
        return next(err);
      }

      const createTableQuery = `
        CREATE TABLE ${db.escapeId(module_name)} (
          ques_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),   -- UUID as primary key
          question TEXT NOT NULL,                        -- Question text
          option_1 VARCHAR(255),                         -- Option 1
          option_2 VARCHAR(255),                         -- Option 2
          option_3 VARCHAR(255),                         -- Option 3
          option_4 VARCHAR(255),                         -- Option 4
          correct_option INT NOT NULL,                   -- Correct option (1, 2, 3, or 4)
          standard INT NOT NULL,                         -- Standard level (e.g., 10th, 12th)
          difficulty ENUM('Easy', 'Medium', 'Hard') NOT NULL  -- Difficulty level
        )
      `;

      db.query(createTableQuery, (err, result) => {
        if (err) {
          console.error('Error creating table:', err);
          return next(err);
        }

        console.log(`Table ${module_name} created successfully`);
        res.redirect('/');
      });
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    next(error);
  }
});

// Delete Module Route
app.delete('/mod/:id/delete', checkAuthenticated, (req, res, next) => {
  const { id } = req.params;
  const getModuleQuery = 'SELECT module FROM modules WHERE mod_id = ?';

  db.query(getModuleQuery, [id], (err, results) => {
    if (err) {
      console.error('Error fetching module name:', err);
      return next(err);
    }

    if (results.length === 0) {
      return res.status(404).send('Module not found');
    }

    const moduleName = results[0].module;
    const deleteTableQuery = `DROP TABLE IF EXISTS ${db.escapeId(moduleName)}`;
    const deleteModuleQuery = 'DELETE FROM modules WHERE mod_id = ?';

    db.query(deleteTableQuery, (err) => {
      if (err) {
        console.error('Error deleting module table:', err);
        return next(err);
      }

      db.query(deleteModuleQuery, [id], (err) => {
        if (err) {
          console.error('Error deleting module record:', err);
          return next(err);
        }

        console.log(`Module ${moduleName} and its table deleted successfully`);
        res.redirect('/');
      });
    });
  });
});



app.get('/mod/:id', checkAuthenticated, (req, res, next) => {
  const { id } = req.params;
  const getModuleQuery = 'SELECT module FROM modules WHERE mod_id = ?';

  db.query(getModuleQuery, [id], (err, results) => {
    if (err) {
      console.error('Error fetching module name:', err);
      return next(err);
    }

    if (results.length === 0) {
      return res.status(404).send('Module not found');
    }

    const modulename = results[0].module;
    const fetchRowsQuery = `SELECT * FROM ${db.escapeId(modulename)}`;

    db.query(fetchRowsQuery, (err, rows) => {
      if (err) {
        console.error('Error fetching rows from table:', err);
        return next(err)
      }
      res.render('mod-data.ejs', {
        modulename,
        rows,
        id
      });
    });
  });
});
// delete questoins

app.delete('/mod/:mod_id/question/:q_id/delete', checkAuthenticated, (req, res, next) => {
  const moduleId = req.params.mod_id;  
  const questionId = req.params.q_id;    

  const getModuleNameQuery = 'SELECT module FROM modules WHERE mod_id = ?';
  connection.query(getModuleNameQuery, [moduleId], (err, results) => {
      if (err) {
          console.error('Error fetching module name:', err);
          return res.status(500).send('Error fetching module name');
      }

      if (results.length === 0) {
          return res.status(404).send('Module not found');
      }

      const moduleName = results[0].module;

      // Dynamically build the query to delete from the correct table
      const deleteQuestionQuery = `DELETE FROM ${moduleName} WHERE id = ?`;
      connection.query(deleteQuestionQuery, [questionId], (err, result) => {
          if (err) {
              console.error('Error deleting question:', err);
              return res.status(500).send('Error deleting question');
          }

          console.log(`Question ${questionId} is deleted from ${moduleName}`);
          res.redirect(`/mod/${moduleId}`);
      });
  });
});


app.get('/new_ques/:id', checkAuthenticated, (req, res, next) => {
  const { id } = req.params;
  const getModuleQuery = 'SELECT module FROM modules WHERE mod_id = ?';

  db.query(getModuleQuery, [id], (err, results) => {
    if (err) {
      console.error('Error fetching module:', err);
      return next(err);
    }

    if (results.length === 0) {
      return res.status(404).send('Module not found');
    }
    const modulename = results[0].module;
    res.render('new_ques.ejs', { id, modulename });
  });
});

app.post('/mod/:id/add_question', checkAuthenticated, (req, res, next) => {
  const { id } = req.params;
  const {
    content,
    option_1,
    option_2,
    option_3,
    option_4,
    correct_option,
    standard,
    difficulty,
  } = req.body;

  const getModuleQuery = 'SELECT module FROM modules WHERE mod_id = ?';

  db.query(getModuleQuery, [id], (err, results) => {
    if (err) {
      console.error('Error fetching module name:', err);
      return next(err);
    }

    if (results.length === 0) {
      return res.status(404).send('Module not found');
    }

    const modulename = results[0].module;
    const insertQuestionQuery = `
      INSERT INTO ${db.escapeId(modulename)} 
      (question, option_1, option_2, option_3, option_4,correct_option, standard, difficulty) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      content,
      option_1,
      option_2,
      option_3,
      option_4,
      correct_option,
      standard,
      difficulty,
    ];

    db.query(insertQuestionQuery, values, (err, result) => {
      if (err) {
        console.error('Error inserting question:', err);
        return next(err);
      }

      console.log('Question added successfully:', result);
      res.redirect(`/mod/${id}`);
    });
  });
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
