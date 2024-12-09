CREATE DATABASE hunar;

USE hunar;

CREATE TABLE user (
    user_id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

DELIMITER $$

CREATE TRIGGER before_insert_user
BEFORE INSERT ON user
FOR EACH ROW
BEGIN
    SET NEW.user_id = CONCAT('USER', LPAD((SELECT IFNULL(MAX(CAST(SUBSTRING(user_id, 4) AS UNSIGNED)), 0) + 1 FROM user), 6, '0'));
END $$

DELIMITER ;

show tables
desc user
show tables

insert into user (name,email,password) value("aditya","aditya@gmail","12345")
select * from modules

CREATE TABLE quizzes (
    quiz_id VARCHAR(36) PRIMARY KEY, -- UUID for quiz identification
    user_id VARCHAR(225) NOT NULL,            -- ID of the user
    mod_id VARCHAR(225) NOT NULL,             -- Module ID
    moduleName VARCHAR(255) NOT NULL, -- Name of the module
    user_score INT DEFAULT 0,        -- User's score (default to 0)
    total_score INT DEFAULT 0,       -- Total score (default to 0)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for when the entry is created
    FOREIGN KEY (mod_id) REFERENCES modules(mod_id), -- Foreign key relation with modules table
    FOREIGN KEY (user_id) REFERENCES user(user_id) -- Optional: If a users table exists
);

CREATE TABLE answers (
    ans_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),       -- Unique identifier for the answer
    quiz_id VARCHAR(36) NOT NULL,         -- Quiz ID to associate the answer with a specific quiz
    user_id varchar(225) NOT NULL,                 -- ID of the user providing the answer
    question_id varchar(225) NOT NULL,             -- ID of the question being answered
    mod_id VARCHAR(36) NOT NULL,          -- Module ID to associate the answer with a specific module
    user_option INT,
    is_correct BOOLEAN,                   -- Whether the answer is correct or not
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for when the answer is recorded
    FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id), -- Relation to quizzes table
    FOREIGN KEY (user_id) REFERENCES user(user_id),   -- Optional: If a users table exists
    FOREIGN KEY (mod_id) REFERENCES modules(mod_id),  -- Relation to modules table
    UNIQUE KEY unique_answer (quiz_id, user_id, question_id, mod_id) -- Unique constraint with mod_id
);





