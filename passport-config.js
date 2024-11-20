const LocalStrategy = require('passport-local').Strategy;
const mysql = require("mysql2");

// Pass the MySQL connection to the config
function initialize(passport, getUserByEmail, getUserById) {
  const authenticateUser = (email, password, done) => {
    const query = 'SELECT * FROM admin WHERE email = ?';
    // console.log("yaha____")
    
    db.query(query, [email], (err, results) => {
      if (err) return done(err);
      
      if (results.length === 0) {
        return done(null, false, { message: 'No user with that email' });
      }

      const user = results[0];

      try {
        if (password === user.password) {

          return done(null, user);
        } else {
          return done(null, false, { message: 'Password incorrect' });
        }
      } catch (e) {
        return done(e);
      }
    });
  };

  passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser));

  // Serialize and deserialize users
  passport.serializeUser((user, done) => done(null, user.adm_id));
  
  passport.deserializeUser((id, done) => {
    const query = 'SELECT * FROM admin WHERE adm_id = ?';
    
    db.query(query, [id], (err, results) => {
      if (err) return done(err);
      return done(null, results[0]);
    });
  });
}

module.exports = initialize;
