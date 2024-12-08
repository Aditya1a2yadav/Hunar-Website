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
    SET NEW.user_id = CONCAT('ADM', LPAD((SELECT IFNULL(MAX(CAST(SUBSTRING(user_id, 4) AS UNSIGNED)), 0) + 1 FROM user), 6, '0'));
END $$

DELIMITER ;

show tables
desc user
show tables

insert into user (name,email,password) value("aditya","aditya@gmail","12345")
select * from user


