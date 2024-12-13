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
const { v4: uuidv4 } = require('uuid');

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

      console.log(`Module ${module_name} created successfully`);
      res.redirect('/');
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
    const deleteModuleQuery = 'DELETE FROM modules WHERE mod_id = ?';
    
    // First, find all question IDs for this module to delete their options
    const findQuestionsQuery = 'SELECT ques_id FROM questions WHERE moduleName = ?';
    
    db.query(findQuestionsQuery, [moduleName], (err, questionResults) => {
      if (err) {
        console.error('Error finding questions:', err);
        return next(err);
      }

      // Extract question IDs
      const questionIds = questionResults.map(q => q.ques_id);

      // Delete options for all questions in this module
      const deleteOptionsQuery = 'DELETE FROM options WHERE ques_id IN (?)';
      
      if (questionIds.length > 0) {
        db.query(deleteOptionsQuery, [questionIds], (err) => {
          if (err) {
            console.error('Error deleting options:', err);
            return next(err);
          }

          // Delete questions for this module
          const deleteQuestionsQuery = 'DELETE FROM questions WHERE moduleName = ?';
          db.query(deleteQuestionsQuery, [moduleName], (err) => {
            if (err) {
              console.error('Error deleting questions:', err);
              return next(err);
            }

            // Delete the module itself
            db.query(deleteModuleQuery, [id], (err) => {
              if (err) {
                console.error('Error deleting module record:', err);
                return next(err);
              }

              console.log(`Module ${moduleName} and its questions and options deleted successfully`);
              res.redirect('/');
            });
          });
        });
      } else {
        // If no questions, directly delete the module
        db.query(deleteModuleQuery, [id], (err) => {
          if (err) {
            console.error('Error deleting module record:', err);
            return next(err);
          }

          console.log(`Module ${moduleName} deleted successfully`);
          res.redirect('/');
        });
      }
    });
  });
});

app.get('/mod/:id', checkAuthenticated, (req, res, next) => {
  const { id } = req.params;
  
  // Fetch module details and questions with dynamic options
  const moduleQuery = `
    SELECT m.mod_id, m.module, 
           (SELECT MAX(option_number) 
            FROM options o 
            JOIN questions q ON o.ques_id = q.ques_id 
            WHERE q.moduleName = m.module) as max_options
    FROM modules m
    WHERE m.mod_id = ?
  `;

  db.query(moduleQuery, [id], (err, moduleResults) => {
    if (err) {
      console.error('Error fetching module details:', err);
      return next(err);
    }

    if (moduleResults.length === 0) {
      return res.status(404).send('Module not found');
    }

    const modulename = moduleResults[0].module;
    const maxOptions = moduleResults[0].max_options || 4;

    // Dynamically build SQL query for options
    const optionsSelect = Array.from(
      { length: maxOptions }, 
      (_, i) => `o${i + 1}.option_text AS option_${i + 1}`
    ).join(', ');

    const optionsJoins = Array.from(
      { length: maxOptions }, 
      (_, i) => `LEFT JOIN options o${i + 1} ON q.ques_id = o${i + 1}.ques_id AND o${i + 1}.option_number = ${i + 1}`
    ).join('\n');

    const fetchQuestionsQuery = `
      SELECT q.*, 
             ${optionsSelect}
      FROM questions q
      ${optionsJoins}
      WHERE q.moduleName = ?
    `;

    db.query(fetchQuestionsQuery, [modulename], (err, questions) => {
      if (err) {
        console.error('Error fetching questions:', err);
        return next(err);
      }

      res.render('mod-data.ejs', {
        modulename,
        id,
        rows:questions,
        maxOptions
      });
    });
  });
});

// Delete Question Route
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

    // Delete associated options first
    const deleteOptionsQuery = 'DELETE FROM options WHERE ques_id = ?';
    connection.query(deleteOptionsQuery, [questionId], (err) => {
      if (err) {
        console.error('Error deleting options:', err);
        return res.status(500).send('Error deleting options');
      }

      // Then delete the question
      const deleteQuestionQuery = 'DELETE FROM questions WHERE ques_id = ?';
      connection.query(deleteQuestionQuery, [questionId], (err, result) => {
        if (err) {
          console.error('Error deleting question:', err);
          return res.status(500).send('Error deleting question');
        }

        console.log(`Question ${questionId} and its options are deleted`);
        res.redirect(`/mod/${moduleId}`);
      });
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
    const moduleName = results[0].module;
    res.render('new_ques.ejs', { mod_id: id, moduleName });
  });
});

app.post('/mod/:id/add_question', checkAuthenticated, (req, res, next) => {
  const { id } = req.params;
  const {
    content,
    correct_option,
    standard,
    difficulty,
    ...options // Capture all additional keys as options
  } = req.body;

  // Extract options dynamically based on keys like option_1, option_2, etc.
  const optionKeys = Object.keys(options).filter(key => key.startsWith('option_'));
  if (optionKeys.length === 0) {
    return res.status(400).send('At least one option is required');
  }
  console.log(optionKeys);

  const optionsValues = optionKeys.map((key, index) => [
    null, // ques_id will be added later dynamically
    index + 1,
    options[key],
  ]);

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
    const ques_id = uuidv4(); // Generate UUID for question

    // Insert question
    const insertQuestionQuery = `
      INSERT INTO questions 
      (ques_id, question, moduleName, correct_option, standard, difficulty) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const questionValues = [
      ques_id,
      content,
      modulename,
      correct_option,
      standard,
      difficulty,
    ];

    db.query(insertQuestionQuery, questionValues, (err, result) => {
      if (err) {
        console.error('Error inserting question:', err);
        return next(err);
      }

      // Update ques_id in optionsValues
      const updatedOptionsValues = optionsValues.map(option => [
        ques_id,
        ...option.slice(1), // Keep option_number and option_text
      ]);

      // Insert options
      const insertOptionsQuery = `
        INSERT INTO options 
        (ques_id, option_number, option_text) 
        VALUES ?
      `;

      db.query(insertOptionsQuery, [updatedOptionsValues], (err, result) => {
        if (err) {
          console.error('Error inserting options:', err);
          return next(err);
        }

        console.log('Question and options added successfully');
        res.redirect(`/mod/${id}`);
      });
    });
  });
});

// Login and Authentication routes remain the same as in the previous version
app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs');
});

app.post('/login', checkNotAuthenticated, (req, res, next) => {
  console.log('Login Form Data:', req.body);
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

app.listen(3003, () => {
  console.log('Server started on http://localhost:3003');
});