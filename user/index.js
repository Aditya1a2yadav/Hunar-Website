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
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, "/public/css")));
app.use(express.static(path.join(__dirname, "/public/js")));
app.use(express.static(path.join(__dirname, "/public/stuffs")));
const { v4: uuidv4 } = require('uuid'); // Import UUID

const { name } = require('ejs');

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


app.get('/', checkAuthenticated, (req, res) => {
    const user_id = req.user.user_id; // Get user_id from session
    const name = req.user.name;
    const query = 'SELECT * FROM modules';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching data from modules table:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Render the home.ejs template
        res.render('home.ejs', { modules: results, name, user_id });
    });
});


app.get('/mod/:mod_id/:user_id/quiz', checkAuthenticated, (req, res, next) => {
    const { mod_id, user_id } = req.params;
    const getModuleQuery = 'SELECT module FROM modules WHERE mod_id = ?';

    db.query(getModuleQuery, [mod_id], (err, results) => {
        if (err) {
            console.error('Error fetching module name:', err);
            return next(err);
        }

        if (results.length === 0) {
            return res.status(404).send('Module not found');
        }

        const modulename = results[0].module;
        const fetchRowsQuery = `SELECT * FROM ${db.escapeId(modulename)}`;
        res.render('quizHome.ejs', { mod_id, modulename, user_id, module: results[0] });
    });
});



app.post('/mod/:mod_id/:user_id/quiz', checkAuthenticated, (req, res, next) => {
    const mod_id = req.params.mod_id;
    const user_id = req.params.user_id;
    const moduleQuery = `SELECT module FROM modules WHERE mod_id = ?`;

    db.query(moduleQuery, [mod_id], (err, moduleResult) => {
        if (err) {
            return next(err); // Handle query error
        }

        // Check if the module exists
        if (moduleResult.length === 0) {
            return res.status(404).json({ error: 'Module not found' });
        }

        const moduleName = moduleResult[0].module;
        const quiz_id = uuidv4();  // Generate unique quiz_id
        const user_score = 0;  // Default score
        const total_score = 0; // Default total score

        // Insert quiz data into the quizzes table
        const insertQuery = `
          INSERT INTO quizzes (quiz_id, user_id, mod_id, moduleName, user_score, total_score)
          VALUES (?, ?, ?, ?, ?, ?)
      `;
        const insertValues = [quiz_id, user_id, mod_id, moduleName, user_score, total_score];

        // Execute the insert query
        db.query(insertQuery, insertValues, (err, result) => {
            if (err) {
                return next(err); // Handle query error
            }

            // console.log("Quiz data inserted successfully");

            // Redirect to the first question of the quiz
            return res.redirect(`/mod/${mod_id}/${user_id}/${quiz_id}/question`);
        });
    });
});


app.get('/mod/:mod_id/:user_id/:quiz_id/question', checkAuthenticated, (req, res, next) => {
    const { mod_id, user_id, quiz_id } = req.params; // Extract parameters from the URL
    const page = parseInt(req.query.page) || 1;
    const limit = 1; // One question per page
    const offset = (page - 1) * limit;

    // Fetch the module name based on mod_id
    const getModuleNameQuery = 'SELECT module FROM modules WHERE mod_id = ?';
    db.query(getModuleNameQuery, [mod_id], (err, moduleResults) => {
        if (err) return next(err);
        if (moduleResults.length === 0) {
            return res.status(404).send('Module not found');
        }

        const moduleName = moduleResults[0].module;

        // Fetch the question and options from the moduleName table with pagination, ordered by difficulty
        const query = `
        SELECT *, difficulty
        FROM ${moduleName}
        ORDER BY FIELD(difficulty, 'easy', 'medium', 'hard') 
        LIMIT ? OFFSET ?
      `;

        db.query(query, [limit, offset], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            if (results.length === 0) {
                return res.render('question.ejs', { question: null, mod_id, moduleName, quiz_id, user_id, currentPage: page, hasNextPage: false });
            }

            // Extract the question and options from the result
            const question = results[0];  // Only one question per page, so we take the first result
            const options = [
                { option_id: 1, option_text: question.option_1, is_correct: question.correct_option === 1 },
                { option_id: 2, option_text: question.option_2, is_correct: question.correct_option === 2 },
                { option_id: 3, option_text: question.option_3, is_correct: question.correct_option === 3 },
                { option_id: 4, option_text: question.option_4, is_correct: question.correct_option === 4 },
            ];

            // Check if there's a next page based on difficulty order
            const nextPageQuery = `
          SELECT 1 FROM ${moduleName} 
          ORDER BY FIELD(difficulty, 'easy', 'medium', 'hard')
          LIMIT 1 OFFSET ?
        `;
            db.query(nextPageQuery, [offset + limit], (err, nextPageResults) => {
                if (err) return res.status(500).json({ error: err.message });
                const hasNextPage = nextPageResults.length > 0;

                // Pass the difficulty level to the template
                res.render('question.ejs', {
                    question,
                    options,
                    moduleName,
                    quiz_id,
                    user_id,
                    mod_id,
                    currentPage: page,
                    hasNextPage,
                    difficulty: question.difficulty // Pass the difficulty level
                });
            });
        });
    });
});


app.post('/quiz/submit/question/:page', checkAuthenticated, (req, res, next) => {
    const { quiz_id, user_id, mod_id, ques_id, user_answer, currentPage } = req.body;
    const { page } = req.params;
    // console.log(req.body)
    // Validate input data
    if (!quiz_id || !user_id || !mod_id || !ques_id || user_answer === undefined || currentPage === undefined) {
        return res.status(400).json({ error: 'Missing required data' });
    }

    // Query to get the module name based on mod_id
    const getModuleNameQuery = `SELECT module FROM modules WHERE mod_id = ?`;

    db.query(getModuleNameQuery, [mod_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.length === 0) {
            return res.status(404).json({ error: 'Module not found' });
        }

        const moduleName = result[0].module;

        // Now use moduleName in the query to check the correct option
        const checkCorrectOptionQuery = `SELECT correct_option FROM ${moduleName} WHERE ques_id = ?`;

        db.query(checkCorrectOptionQuery, [ques_id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            if (result.length === 0) {
                return res.status(404).json({ error: 'Question not found' });
            }

            const correct_option = result[0].correct_option;
            const isCorrect = user_answer == correct_option;

            // Insert or update the answer into the answers table
            const insertOrUpdateQuery = `
          INSERT INTO answers (quiz_id, user_id, question_id, mod_id, user_option, is_correct)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            user_option = VALUES(user_option),
            is_correct = VALUES(is_correct)
        `;

            db.query(insertOrUpdateQuery, [quiz_id, user_id, ques_id, mod_id, user_answer, isCorrect], (err, result) => {
                if (err) return res.status(500).json({ error: err.message });

                // Redirect to the next/prev question
                const nextPage = page;
                res.redirect(`/mod/${mod_id}/${user_id}/${quiz_id}/question?page=${page}`);
            });
        });
    });
});

app.get('/mod/:mod_id/:user_id/:quiz_id/result', checkAuthenticated, (req, res, next) => {
    const { mod_id, user_id, quiz_id } = req.params;

    const getModuleNameQuery = `SELECT module FROM modules WHERE mod_id = ?`;

    db.query(getModuleNameQuery, [mod_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.length == 0) {
            return res.status(404).json({ error: 'Module not found' });
        }

        const moduleName = result[0].module;

        // Query to get the user's answers and calculate their score based on difficulty
        const getUserAnswersQuery = `
        SELECT a.question_id, a.user_option, a.is_correct, q.question, q.option_1, q.option_2, q.option_3, q.option_4, q.difficulty
        FROM answers a
        JOIN ${moduleName} q ON a.question_id = q.ques_id
        WHERE a.quiz_id = ? AND a.user_id = ? AND a.mod_id = ?
        ORDER BY 
            CASE 
                WHEN q.difficulty = 'Easy' THEN 1
                WHEN q.difficulty = 'Medium' THEN 2
                WHEN q.difficulty = 'Hard' THEN 3
            END
      `;

        db.query(getUserAnswersQuery, [quiz_id, user_id, mod_id], (err, answersResult) => {
            if (err) return res.status(500).json({ error: err.message });

            if (answersResult.length === 0) {
                return res.status(404).json({ error: 'No answers found for this user' });
            }

            // Calculate the total score based on the difficulty level of each question
            let totalScore = 0;
            let total = 0;
            let correctAnswers = 0;

            answersResult.forEach(answer => {
                let questionScore = 0;

                // Assign points based on difficulty
                if (answer.difficulty === 'Easy') {
                    questionScore = 10;
                } else if (answer.difficulty === 'Medium') {
                    questionScore = 20;
                } else if (answer.difficulty === 'Hard') {
                    questionScore = 30;
                }

                total += questionScore;
                if (answer.is_correct) {
                    totalScore += questionScore;
                    correctAnswers++;
                }
            });

            // Update the user_score in the quizzes table for the current quiz
            const updateUserScoreQuery = `
          UPDATE quizzes
          SET user_score = ?, total_score = ?
          WHERE quiz_id = ?
        `;

            db.query(updateUserScoreQuery, [totalScore, total, quiz_id], (err, updateResult) => {
                if (err) return res.status(500).json({ error: err.message });

                // Fetch the updated quiz details
                const getQuizDetailsQuery = `SELECT * FROM quizzes WHERE quiz_id = ?`;

                db.query(getQuizDetailsQuery, [quiz_id], (err, quizResult) => {
                    if (err) return res.status(500).json({ error: err.message });

                    if (quizResult.length === 0) {
                        return res.status(404).json({ error: 'Quiz not found' });
                    }

                    // Render the result page with the user's answers, score, and quiz details
                    res.render('result.ejs', {
                        moduleName,
                        user_id,
                        quiz_id,
                        answers: answersResult,
                        score: totalScore,
                        total,
                        correctAnswers,
                        totalQuestions: answersResult.length,
                        difficultyScores: { Easy: 10, Medium: 20, Hard: 30 },
                        quizDetails: quizResult[0] // Send quiz details
                    });
                });
            });
        });
    });
});

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

app.listen(8080, () => {
    console.log('Server started on http://localhost:8080');
});
