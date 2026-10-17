const express = require('express');
const router = express.Router();
var sha1 = require('sha1');

var db = require('../utils/database');

const pwdRegExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const emailRegExp = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;

// Register
router.post('/register',  (req, res) => {
    const {name, email, password, confirm} = req.body;

    // Validate input

    // Check for empty fields
    if (!name || !email || !password || !confirm) {
        return res.status(400).json({error: "Missing required fields"});
    }

    // Check if email is an actual email
    if (!email.match(emailRegExp)) {
        return res.status(400).json({error: "Email is not valid!"});
    }


    // Check if passwords match
    if (password !== confirm) {
        return res.status(400).json({error: "Passwords do not match"});
    }

    // Check for password strength
    if (!password.match(pwdRegExp)) {
        return res.status(400).json({error: "Passwords is too weak!"});
    }

    // Check if email already exists
    db.query("SELECT * FROM users WHERE email = ?", [email], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.length > 0) {
            return res.status(400).json({error: "This E-mail is already in use!"});
        }

        // Insert new user into DB
        db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, SHA1(?), "user")', [name, email, password], (error, results) => {
            if (error) {
                return res.status(500).json({error: "Database query error"});
            }

            return res.status(201).json({message: "User registered succesfully", results: results[0]});
        });
    });
});

// Login
router.post('/login', (req, res) => {
    const {email, password} = req.body;

    // Validate inputs
    if (!email || !password) {
        return res.status(400).json({error: "Missing required fields"});
    }

    // Check email and password in DB
    db.query("SELECT * FROM users WHERE email = ? AND password = SHA1(?)", [email, password], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }
        
        // If doesn't exist with this email and password
        if (results.length == 0) {
            return res.status(400).json({error: "Invalid credentials"});
        }

        if (results[0].is_active == 0) {
            return res.status(400).json({error: "User has been banned by an admin!"});
        }

        const loggedUser = {
            ID: results[0].ID,
            name: results[0].name,
            email: results[0].email,
            role: results[0].role
        };

        // Update last_login and login_count fields
        db.query("UPDATE users SET last_login=CURRENT_TIMESTAMP, login_count=login_count+1 WHERE ID=?", [loggedUser.ID], (error, results) => {
            if (error) {
                return res.status(500).json({error: "Database query error"});
            }

            // If user exists with email and password
            return res.status(200).json({message: "You've been successfully logged in!", loggedUser: loggedUser});
        });
    });
});

// Password change
router.post('/:uid/changepass', (req, res) => {
    const {oldpass, newpass, confirm} = req.body;
    const uid = req.params.uid;

    if (!oldpass || !newpass || !confirm) {
        return res.status(400).json({error: "Missing required fields"});
    }

    if (newpass !== confirm) {
        return res.status(400).json({error: "The new password and it's confirm don't match!"});
    }

    if (oldpass == newpass) {
        return res.status(400).json({error: "The new password cannot be the same as the old one!"});
    }

    db.query("SELECT * FROM users WHERE ID=?", [uid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.length == 0) {
            return res.status(400).json({error: "No such user exists!"});
        }

        if (results[0].password != sha1(oldpass)) {
            return res.status(500).json({error: "The old password is incorrect!"});
        }

        // Update password
        db.query("UPDATE users SET password=SHA1(?) WHERE ID=?", [newpass, uid], (error, results) => {
            if (error) {
                return res.status(500).json({error: "Database query error"});
            }

            return res.status(200).json({message: "The password was modified successfully!"});
        });
    });
});

// Get Profile
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
            "name": results[0].name,
            "email": results[0].email,
            "role": results[0].role,
            "created_at": results[0].created_at,
        }

        return res.status(200).json({results: user});
    });
});

// Update Profile (username, email)
router.patch('/:uid', (req, res) => {
    const uid = req.params.uid;
    const {username, email, luid} = req.body;

    if (!uid || !username || !email || !luid) {
        return res.status(400).json({error: "Missing required fields"});
    }

    if (uid != luid) {
        return res.status(403).json({error: "You don't have permission to update this user!"});
    }

    db.query("SELECT * FROM users WHERE ID=?", [uid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.length == 0) {
            return res.status(400).json({error: "No such user exists with this ID"});
        }

        // Ha ugyanazok az adatok, mint a táblában, akkor nincs update
        if ((username == results[0].name) && (email == results[0].email)) {
            return res.status(200).json({message: "No update occured!"});
        }

        db.query("SELECT * FROM users WHERE email=? and ID<>?", [email, uid], (error, results2) => {
            if (error) {
                return res.status(500).json({error: "Database query error"});
            }

            if (results2.length > 0) {
                return res.status(400).json({error: "This e-mail address is already in use!"});
            }

            db.query("UPDATE users SET name=?, email=? WHERE ID=?", [username, email, uid], (error, results) => {
                if (error) {
                    return res.status(500).json({error: "Database query error"});
                }

                return res.status(200).json({message: "User updated successfully!"});
            });
        });
    });
});

// Delete Profile
router.delete('/:uid', (req, res) => {
    const loggedUserID = req.body.luid;
    const uid = req.params.uid;

    if (!uid || !loggedUserID) {
        return res.status(400).json({error: "Missing user identifier"});
    }

    if (uid != loggedUserID) {
        return res.status(403).json({error: "You don't have permission to delete this user!"});
    }

    db.query("DELETE FROM users WHERE ID=?", [uid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.affectedRows == 1) {
            return res.status(200).json({message: "Successfully deleted user!"});
        }

        return res.status(200).json({message: "No deletion occured!"});
    });
});

module.exports = router;