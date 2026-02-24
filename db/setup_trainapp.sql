-- Run this entire script while logged in as root in the mysql> prompt
-- Step 1: Create the database
CREATE DATABASE IF NOT EXISTS trainapp;

-- Step 2: Create the user and set password
CREATE USER IF NOT EXISTS 'trainapp'@'localhost' IDENTIFIED BY 'Trainapp#1234';

-- Step 3: Grant all privileges to the user on this database
GRANT ALL PRIVILEGES ON trainapp.* TO 'trainapp'@'localhost';
FLUSH PRIVILEGES;

-- Step 4: Switch to the database
USE trainapp;

-- Step 5: Create the trains table (for the Train-Project backend)
CREATE TABLE IF NOT EXISTS trains (
    train_id    INT          NOT NULL AUTO_INCREMENT,
    train_name  VARCHAR(100) NOT NULL,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (train_id)
);

-- Step 6: Create the zones table (for the sensor devices)
CREATE TABLE IF NOT EXISTS zones (
    zone_id     INT          NOT NULL AUTO_INCREMENT,
    zone_name   VARCHAR(100) NOT NULL UNIQUE,
    device_code VARCHAR(255) NOT NULL UNIQUE,
    latitude    DECIMAL(10,7) NULL,
    longitude   DECIMAL(10,7) NULL,
    status      TINYINT(1)   NOT NULL DEFAULT 0,
    checked_at  TIMESTAMP    NULL     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (zone_id)
);

-- Step 7: Insert one test zone for ZONE_1 device
INSERT INTO zones (zone_name, device_code, latitude, longitude, status)
VALUES ('Zone 1 - Test Track', 'ZONE_1', NULL, NULL, 0)
ON DUPLICATE KEY UPDATE zone_name = zone_name;

-- Verify everything is set up correctly
SHOW TABLES;
SELECT * FROM zones;
