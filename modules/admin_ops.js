const express = require('express');
const router = express.Router();

var db = require('../utils/database');

// Get all users
router.post('/users', (req, res) => {
    const luid = req.body.luid;

    if (!luid) {
        return res.status(400).json({error: "Missing user identifier"});
    }

    db.query("SELECT * FROM users WHERE ID=?", [luid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.length == 0) {
            return res.status(400).json({error: "No such user with this ID!"});
        }

        if (results[0].role != "admin") {
            return res.status(403).json({error: "You don't have permission to change user status!"});
        }

        db.query("SELECT * FROM users", (error1, results1) => {
            if (error1) {
                return res.status(500).json(`Database query error: ${error1.message}`);
            } else {
                return res.status(200).json(results1);
            }
        });
    });
});

// Get specific user
router.get('/:uid', (req, res) => {
    const uid = req.params.uid;

    if (!uid) {
        return res.status(400).json({error: "Missing user identifier"});
    }

    db.query("SELECT * FROM users WHERE ID=?", [uid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.length == 0) {
            return res.status(400).json({error: "User with this ID doesn't exist!"});
        }

        let user = {
            "ID": results[0].ID,
            "name": results[0].name,
            "email": results[0].email,
            "password": results[0].password,
            "role": results[0].role,
            "created_at": results[0].created_at,
            "updated_at": results[0].updated_at,
            "last_login": results[0].last_login,
            "login_count": results[0].login_count,
            "is_active": results[0].is_active,
        }

        return res.status(200).json({results: user});
    });
});

// Deny user
router.patch('/status', (req, res) => {
    const {uid, luid} = req.body;

    if (!uid || !luid) {
        return res.status(400).json({error: "Missing user identifier"});
    }

    db.query("SELECT * FROM users WHERE ID=?", [luid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.length == 0) {
            return res.status(400).json({error: "No such user with this ID!"});
        }

        if (results[0].role != "admin") {
            return res.status(403).json({error: "You don't have permission to access this!"});
        }

        db.query("SELECT * FROM users WHERE ID=?", [uid], (error1, results1) => {
            if (error1) {
                return res.status(500).json({error: "Database query error"});
            }

            if (results1.length == 0) {
                return res.status(200).json({message: "User with this ID does not exist!"});
            }

            db.query("UPDATE users SET is_active = not is_active WHERE ID=?", [uid], (error2, results2) => {
                if (error2) {
                    return res.status(500).json({error: "Database query error"});
                }

                return res.status(200).json({message: "User status changed!"});
            });
        });
    });
    
});

// Delete user
router.delete('/:uid', (req, res) => {
    const uid = req.params.uid;
    const luid = req.body.luid;

    if (!uid || !luid) {
        return res.status(400).json({error: "Missing user identifier"});
    }

    db.query("SELECT * FROM users WHERE ID=?", [luid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.length == 0) {
            return res.status(400).json({error: "No such user with this ID!"});
        }

        if (results[0].role != "admin") {
            return res.status(403).json({error: "You don't have permission to access this!"});
        }

        db.query("SELECT * FROM users WHERE ID=?", [uid], (error1, results1) => {
            if (error1) {
                return res.status(500).json({error: "Database query error"});
            }

            if (results1.length == 0) {
                return res.status(200).json({message: "User with this ID does not exist!"});
            }

            db.query("DELETE FROM users WHERE ID=?", [uid], (error2, results2) => {
                if (error2) {
                    return res.status(500).json({error: "Database query error"});
                }

                if (results2.affectedRows == 1) {
                    return res.status(200).json({message: "User deleted successfully!"})
                }
            });
        });
    });
});

module.exports = router;