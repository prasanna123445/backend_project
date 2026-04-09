const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const db = new sqlite3.Database(path.join(__dirname, '../../database.sqlite'), (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run('PRAGMA foreign_keys = ON;');
    
    // Create Tables
    db.serialize(() => {
      // Users Table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
      )`);

      // Courses Table
      db.run(`CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        title TEXT,
        description TEXT,
        credits INTEGER,
        instructor TEXT,
        capacity INTEGER,
        days TEXT,
        start_time TEXT,
        end_time TEXT
      )`);

      // Registrations Table
      db.run(`CREATE TABLE IF NOT EXISTS registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        course_id INTEGER,
        status TEXT,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      )`);

      // Seed Admin User
      const adminPass = bcrypt.hashSync('admin123', 10);
      db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', ?, 'ADMIN')`, [adminPass]);

      // Seed Student User
      const studentPass = bcrypt.hashSync('student123', 10);
      db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('student', ?, 'STUDENT')`, [studentPass]);

      // Seed test course
      db.run(`INSERT OR IGNORE INTO courses (code, title, description, credits, instructor, capacity, days, start_time, end_time) 
        VALUES ('CS101', 'Intro to Computer Science', 'Learn programming basics.', 3, 'Dr. Smith', 30, 'MWF', '10:00', '11:00')`);
      db.run(`INSERT OR IGNORE INTO courses (code, title, description, credits, instructor, capacity, days, start_time, end_time) 
        VALUES ('MATH201', 'Calculus II', 'Advanced integral calculus.', 4, 'Prof. Johnson', 40, 'TTh', '09:30', '11:00')`);
      db.run(`INSERT OR IGNORE INTO courses (code, title, description, credits, instructor, capacity, days, start_time, end_time) 
        VALUES ('ENG101', 'English Composition', 'Essays and reading.', 3, 'Dr. Davis', 25, 'MWF', '10:30', '11:30')`); 
        // Note: ENG101 conflicts with CS101.
    });
  }
});

module.exports = db;
