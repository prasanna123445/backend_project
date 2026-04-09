const db = require('../config/database');

// Helpers for conflict resolution
function doTimesOverlap(start1, end1, start2, end2) {
  const [h1s, m1s] = start1.split(':').map(Number);
  const [h1e, m1e] = end1.split(':').map(Number);
  const [h2s, m2s] = start2.split(':').map(Number);
  const [h2e, m2e] = end2.split(':').map(Number);
  
  const min1s = h1s * 60 + m1s;
  const min1e = h1e * 60 + m1e;
  const min2s = h2s * 60 + m2s;
  const min2e = h2e * 60 + m2e;
  
  return min1s < min2e && min2s < min1e;
}

function doDaysOverlap(days1, days2) {
  for(let i=0; i<days1.length; i++) {
    if (days2.includes(days1[i])) return true;
  }
  return false;
}

exports.getRegistrations = (req, res) => {
  if (req.user.role === 'ADMIN') {
    db.all(`SELECT r.id, r.status, u.username, c.code, c.title, c.days, c.start_time, c.end_time 
            FROM registrations r 
            JOIN users u ON u.id = r.student_id 
            JOIN courses c ON c.id = r.course_id`, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    // Student logic
    db.all(`SELECT r.id as registration_id, r.status, c.* 
            FROM registrations r 
            JOIN courses c ON c.id = r.course_id 
            WHERE r.student_id = ?`, [req.user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }
};

exports.registerCourse = (req, res) => {
  const { course_id } = req.body;
  const student_id = req.user.id;

  db.get(`SELECT * FROM courses WHERE id = ?`, [course_id], (err, targetCourse) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!targetCourse) return res.status(404).json({ error: 'Course not found' });

    db.get(`SELECT * FROM registrations WHERE student_id = ? AND course_id = ?`, [student_id, course_id], (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });
      if (existing) return res.status(400).json({ error: 'Already registered for this course' });

      db.get(`SELECT COUNT(*) as count FROM registrations WHERE course_id = ?`, [course_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row.count >= targetCourse.capacity) {
          return res.status(400).json({ error: 'Course is full' });
        }

        db.all(`SELECT c.* FROM registrations r JOIN courses c ON r.course_id = c.id WHERE r.student_id = ?`, [student_id], (err, schedule) => {
          if (err) return res.status(500).json({ error: err.message });
          
          let conflict = null;
          for(let myCourse of schedule) {
            if (doDaysOverlap(myCourse.days, targetCourse.days)) {
              if (doTimesOverlap(myCourse.start_time, myCourse.end_time, targetCourse.start_time, targetCourse.end_time)) {
                conflict = myCourse;
                break;
              }
            }
          }

          if (conflict) {
            return res.status(409).json({ error: 'Schedule conflict', conflict: conflict });
          }

          db.run(`INSERT INTO registrations (student_id, course_id, status) VALUES (?, ?, 'REGISTERED')`, 
          [student_id, course_id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, message: 'Successfully registered' });
          });
        });
      });
    });
  });
};

exports.dropRegistration = (req, res) => {
  const regId = req.params.id;
  if (req.user.role === 'ADMIN') {
    db.run(`DELETE FROM registrations WHERE id = ?`, [regId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Registration deleted' });
    });
  } else {
    db.run(`DELETE FROM registrations WHERE id = ? AND student_id = ?`, [regId, req.user.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Registration not found or unauthorized' });
      res.json({ message: 'Course dropped' });
    });
  }
};
