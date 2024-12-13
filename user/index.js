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

        if (moduleResult.length === 0) {
            return res.status(404).json({ error: 'Module not found' });
        }

        const moduleName = moduleResult[0].module;
        const quiz_id = uuidv4();  // Generate unique quiz_id
        const user_score = 0;  // Default score
        const total_score = 0; // Default total score

        const insertQuery = `
          INSERT INTO quizzes (quiz_id, user_id, mod_id, moduleName, user_score, total_score)
          VALUES (?, ?, ?, ?, ?, ?)
      `;
        const insertValues = [quiz_id, user_id, mod_id, moduleName, user_score, total_score];

        // Execute the insert query
        db.query(insertQuery, insertValues, (err, result) => {
            if (err) {
                return next(err);
            }

            return res.redirect(`/mod/${mod_id}/${user_id}/${quiz_id}/question`);
        });
    });
});

// Route to fetch a question based on module, user, and quiz
app.get('/mod/:mod_id/:user_id/:quiz_id/question', checkAuthenticated, (req, res, next) => {
    const { mod_id, user_id, quiz_id } = req.params;
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

        // Fetch the next unseen question
        console.log('hello');
        const fetchQuestionQuery = `
            SELECT q.*
            FROM (
                (SELECT * FROM questions WHERE moduleName = ? AND difficulty IS NULL ORDER BY RAND() LIMIT 5)
                UNION ALL
                (SELECT * FROM questions WHERE moduleName = ? AND difficulty = 'Easy' ORDER BY RAND() LIMIT 5)
                UNION ALL
                (SELECT * FROM questions WHERE moduleName = ? AND difficulty = 'Medium' ORDER BY RAND() LIMIT 5)
                UNION ALL
                (SELECT * FROM questions WHERE moduleName = ? AND difficulty = 'Hard' ORDER BY RAND() LIMIT 5)
            ) AS q
            WHERE ques_id NOT IN (
                SELECT question_id 
                FROM answers 
                WHERE user_id = ? AND quiz_id = ?
            )
            ORDER BY FIELD(difficulty,NULL, 'Easy', 'Medium', 'Hard')
            LIMIT ? OFFSET ?;
        `;

        db.query(fetchQuestionQuery, [moduleName, moduleName, moduleName, moduleName, user_id, quiz_id, limit, offset], (err, questionResults) => {
            if (err) return res.status(500).json({ error: err.message });
            console.log('hell2');
            if (questionResults.length === 0) {
                return res.render('question.ejs', { 
                    question: null, 
                    mod_id, 
                    moduleName, 
                    quiz_id, 
                    user_id, 
                    currentPage: page, 
                    hasNextPage: false 
                });
            }

            const question = questionResults[0];
            console.log(question);
            // Fetch options for the current question
            const optionsQuery = `
                SELECT * 
                FROM options 
                WHERE ques_id = ? 
                ORDER BY option_number
            `;

            db.query(optionsQuery, [question.ques_id], (err, optionsResults) => {
                if (err) return res.status(500).json({ error: err.message });

                const options = optionsResults.map(option => ({
                    option_id: option.option_id,
                    option_number: option.option_number,
                    option_text: option.option_text,
                    is_correct: option.option_number === question.correct_option
                }));

                // Check if there's a next question
                const nextPageQuery = `
                    SELECT 1 
                    FROM (
                        (SELECT * FROM questions WHERE moduleName = ? AND difficulty IS NULL ORDER BY RAND() LIMIT 5)
                        UNION ALL
                        (SELECT * FROM questions WHERE moduleName = ? AND difficulty = 'Easy' ORDER BY RAND() LIMIT 5)
                        UNION ALL
                        (SELECT * FROM questions WHERE moduleName = ? AND difficulty = 'Medium' ORDER BY RAND() LIMIT 5)
                        UNION ALL
                        (SELECT * FROM questions WHERE moduleName = ? AND difficulty = 'Hard' ORDER BY RAND() LIMIT 5)
                    ) AS q
                    WHERE ques_id NOT IN (
                        SELECT question_id 
                        FROM answers 
                        WHERE user_id = ? AND quiz_id = ?
                    )
                    LIMIT 1 OFFSET ?;
                `;

                db.query(nextPageQuery, [moduleName, moduleName, moduleName, moduleName, user_id, quiz_id, offset + limit], (err, nextPageResults) => {
                    if (err) return res.status(500).json({ error: err.message });
                    const hasNextPage = nextPageResults.length > 0;

                    res.render('question.ejs', {
                        question,
                        options,
                        moduleName,
                        quiz_id,
                        user_id,
                        mod_id,
                        currentPage: page,
                        hasNextPage,
                        difficulty: question.difficulty
                    });
                });
            });
        });
    });
});

// Submit question route
app.post('/quiz/submit/question/:page', checkAuthenticated, (req, res, next) => {
    const { quiz_id, user_id, mod_id, ques_id, user_answer } = req.body;
    const { page } = req.params;

    // Validate input data
    if (!quiz_id || !user_id || !mod_id || !ques_id || user_answer === undefined) {
        return res.status(400).json({ error: 'Missing required data' });
    }

    // Get module name
    const getModuleNameQuery = `SELECT module FROM modules WHERE mod_id = ?`;

    db.query(getModuleNameQuery, [mod_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.length === 0) {
            return res.status(404).json({ error: 'Module not found' });
        }

        const moduleName = result[0].module;

        // Check the correct option for the question
        const checkCorrectOptionQuery = `
            SELECT correct_option 
            FROM questions 
            WHERE ques_id = ? AND moduleName = ?
        `;

        db.query(checkCorrectOptionQuery, [ques_id, moduleName], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            if (result.length === 0) {
                return res.status(404).json({ error: 'Question not found' });
            }

            const correct_option = result[0].correct_option;
            const isCorrect = parseInt(user_answer) === correct_option;

            // Insert or update the answer
            const insertOrUpdateQuery = `
                INSERT INTO answers (quiz_id, user_id, question_id, mod_id, user_option, is_correct)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    user_option = VALUES(user_option),
                    is_correct = VALUES(is_correct)
            `;

            db.query(insertOrUpdateQuery, [quiz_id, user_id, ques_id, mod_id, user_answer, isCorrect], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                res.redirect(`/mod/${mod_id}/${user_id}/${quiz_id}/question?page=${page}`);
            });
        });
    });
});


// Result route
app.get('/mod/:mod_id/:user_id/:quiz_id/result', checkAuthenticated, (req, res, next) => {
    const { mod_id, user_id, quiz_id } = req.params;

    const getModuleNameQuery = `SELECT module FROM modules WHERE mod_id = ?`;

    db.query(getModuleNameQuery, [mod_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.length == 0) {
            return res.status(404).json({ error: 'Module not found' });
        }

        const moduleName = result[0].module;

        // Query to get user's answers with options
        const getUserAnswersQuery = `
            SELECT 
                a.question_id, 
                a.user_option, 
                a.is_correct, 
                q.question, 
                q.difficulty,
                q.correct_option,
                o_user.option_text AS user_answer_text,
                o_correct.option_text AS correct_answer_text
            FROM answers a
            JOIN questions q ON a.question_id = q.ques_id
            LEFT JOIN options o_user ON a.question_id = o_user.ques_id AND a.user_option = o_user.option_number
            LEFT JOIN options o_correct ON a.question_id = o_correct.ques_id AND q.correct_option = o_correct.option_number
            WHERE a.quiz_id = ? AND a.user_id = ? AND a.mod_id = ? AND q.moduleName = ?
            ORDER BY 
                CASE 
                    WHEN q.difficulty = 'Easy' THEN 1
                    WHEN q.difficulty = 'Medium' THEN 2
                    WHEN q.difficulty = 'Hard' THEN 3
                END
        `;

        db.query(getUserAnswersQuery, [quiz_id, user_id, mod_id, moduleName], (err, answersResult) => {
            if (err) return res.status(500).json({ error: err.message });

            if (answersResult.length === 0) {
                return res.status(404).json({ error: 'No answers found for this user' });
            }

            // Calculate score with dynamic difficulty points
            let totalScore = 0;
            let total = 0;
            let correctAnswers = 0;

            answersResult.forEach(answer => {
                let questionScore = 0;

                // Assign points based on difficulty
                switch(answer.difficulty) {
                    case 'Easy': questionScore = 10; break;
                    case 'Medium': questionScore = 20; break;
                    case 'Hard': questionScore = 30; break;
                }

                total += questionScore;
                if (answer.is_correct) {
                    totalScore += questionScore;
                    correctAnswers++;
                }
            });

            // Update quiz score
            const updateUserScoreQuery = `
                UPDATE quizzes
                SET user_score = ?, total_score = ?
                WHERE quiz_id = ?
            `;

            db.query(updateUserScoreQuery, [totalScore, total, quiz_id], (err, updateResult) => {
                if (err) return res.status(500).json({ error: err.message });

                // Fetch updated quiz details
                const getQuizDetailsQuery = `SELECT * FROM quizzes WHERE quiz_id = ?`;

                db.query(getQuizDetailsQuery, [quiz_id], (err, quizResult) => {
                    if (err) return res.status(500).json({ error: err.message });

                    if (quizResult.length === 0) {
                        return res.status(404).json({ error: 'Quiz not found' });
                    }

                    // Render result page
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
                        quizDetails: quizResult[0]
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
