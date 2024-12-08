CREATE DATABASE hunar;

USE hunar;

CREATE TABLE admin (
    adm_id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

DELIMITER $$

CREATE TRIGGER before_insert_admin
BEFORE INSERT ON admin
FOR EACH ROW
BEGIN
    SET NEW.adm_id = CONCAT('ADM', LPAD((SELECT IFNULL(MAX(CAST(SUBSTRING(adm_id, 4) AS UNSIGNED)), 0) + 1 FROM admin), 6, '0'));
END $$

DELIMITER ;

show tables
desc admin
show tables

insert into admin (name,email,password) value("aditya","aditya@gmail","12345")
select * from admin


