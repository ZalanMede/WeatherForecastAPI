require('dotenv').config();
const express = require('express');
var cors = require('cors');
const mysql = require('mysql');
const { get } = require('node:http');
const { CLIENT_RENEG_LIMIT } = require('node:tls');
var sha1 = require('sha1');

const app = express();
const port = process.env.APP_PORT;
const pwdRegExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const emailRegExp = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;

var pool  = mysql.createPool({
    connectionLimit : process.env.DB_CONN_LIMIT,
    host            : process.env.DB_HOST,
    user            : process.env.DB_USER,
    password        : process.env.DB_PASS,
    port            : process.env.DB_PORT,
    database        : process.env.DB_NAME,
    timezone        : process.env.DB_TIMEZONE
});

app.use(express.urlencoded({ extended: true}));
app.use(express.json());
app.use(cors());

app.get('/', (_req, res) => {
    res.send('Welcome to the Weather Forecast API');
});

// USER ENDPOINTS -----

// Register
app.post('/users/register',  (req, res) => {
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
    pool.query("SELECT * FROM users WHERE email = ?", [email], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.length > 0) {
            return res.status(400).json({error: "This E-mail is already in use!"});
        }

        // Insert new user into DB
        pool.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, SHA1(?), "user")', [name, email, password], (error, results) => {
            if (error) {
                return res.status(500).json({error: "Database query error"});
            }

            return res.status(201).json({message: "User registered succesfully", results: results[0]});
        });
    });
});

// Login
app.post('/users/login', (req, res) => {
    const {email, password} = req.body;

    // Validate inputs
    if (!email || !password) {
        return res.status(400).json({error: "Missing required fields"});
    }

    // Check email and password in DB
    pool.query("SELECT * FROM users WHERE email = ? AND password = SHA1(?)", [email, password], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }
        
        // If doesn't exist with this email and password
        if (results.length == 0) {
            return res.status(400).json({error: "Invalid credentials"});
        }

        if (results[0].is_active == 0) {
            return res.status(400).json({error: "User has been banned by an admin!"})
        }

        const loggedUser = {
            ID: results[0].ID,
            name: results[0].name,
            email: results[0].email,
            role: results[0].role
        };

        // Update last_login and login_count fields
        pool.query("UPDATE users SET last_login=CURRENT_TIMESTAMP, login_count=login_count+1 WHERE ID=?", [loggedUser.ID], (error, results) => {
            if (error) {
                return res.status(500).json({error: "Database query error"});
            }

            // If user exists with email and password
            return res.status(200).json({message: "You've been successfully logged in!", loggedUser: loggedUser});
        });
    });
});

// Password change
app.post('/users/:uid/changepass', (req, res) => {
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

    pool.query("SELECT * FROM users WHERE ID=?", [uid], (error, results) => {
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
        pool.query("UPDATE users SET password=SHA1(?) WHERE ID=?", [newpass, uid], (error, results) => {
            if (error) {
                return res.status(500).json({error: "Database query error"});
            }

            return res.status(200).json({message: "The password was modified successfully!"});
        });
    });
});

// Get Profile
app.get('/users/:uid/', (req, res) => {
    const uid = req.params.uid;

    if (!uid) {
        return res.status(400).json({error: "Missing user identifier"});
    }

    pool.query("SELECT * FROM users WHERE ID=?", [uid], (error, results) => {
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
app.patch('/users/:uid/', (req, res) => {
    const uid = req.params.uid;
    const {username, email, luid} = req.body;

    if (!uid || !username || !email || !luid) {
        return res.status(400).json({error: "Missing required fields"});
    }

    if (uid != luid) {
        return res.status(403).json({error: "You don't have permission to update this user!"});
    }

    pool.query("SELECT * FROM users WHERE ID=?", [uid], (error, results) => {
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

        pool.query("SELECT * FROM users WHERE email=? and ID<>?", [email, uid], (error, results2) => {
            if (error) {
                return res.status(500).json({error: "Database query error"});
            }

            if (results2.length > 0) {
                return res.status(400).json({error: "This e-mail address is already in use!"});
            }

            pool.query("UPDATE users SET name=?, email=? WHERE ID=?", [username, email, uid], (error, results) => {
                if (error) {
                    return res.status(500).json({error: "Database query error"});
                }

                return res.status(200).json({message: "User updated successfully!"});
            });
        });
    });
});

// Delete Profile
app.delete('/users/:uid', (req, res) => {
    const loggedUserID = req.body.luid;
    const uid = req.params.uid;

    if (!uid || !loggedUserID) {
        return res.status(400).json({error: "Missing user identifier"});
    }

    if (uid != loggedUserID) {
        return res.status(403).json({error: "You don't have permission to delete this user!"});
    }

    pool.query("DELETE FROM users WHERE ID=?", [uid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.affectedRows == 1) {
            return res.status(200).json({message: "Successfully deleted user!"});
        }

        return res.status(200).json({message: "No deletion occured!"});
    });
});

// WEATHER ENDPOINTS -----

// Admin weather endpoints

// Create forecast
app.post('/forecast', (req, res) => {
    // data needs to have: data.date, data.loc, data.tMin, data.tMax, data.weaType, data.prec, data.precProb, data.windSpeed, data.windDir, data.humid, data.press, data.uv
    const {data, luid} = req.body;

    if (!data || !luid ) {
        return res.status(400).json({error: "Missing required fields"});
    }

    pool.query("SELECT role FROM users WHERE id = ?", [luid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.length == 0) {
            return res.status(400).json({error: "No users with this ID"});
        }

        if (results[0].role != "admin") {
            return res.status(403).json({error: "You don't have permission to create forecasts!"});
        }

        // Check if record already exists within almost an hour in both directions
        pool.query("SELECT * FROM weather WHERE date BETWEEN DATEADD(SECOND,-3599,?) AND DATEADD(SECOND,3599,?)", [data.date, data.date], (error1, results1) => {
            if (error1) {
                return res.status(500).json({error: "Database query error"});
            }

            if (results1.length == 0) {
                pool.query("INSERT INTO weather (date, location, temp_min, temp_max, weather_type, precipitation, precipitation_prob, wind_speed, wind_direction, humidity, pressure, uv_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [data.date, data.loc, data.tMin, data.tMax, data.weaType, data.prec, data.precProb, data.windSpeed, data.windDir, data.humid, data.press, data.uv], (error1, _results) => {
                    if (error1) {
                        return res.status(500).json(`Database query error: ${error1}`);
                    }

                    return res.status(200).json({message: "Weather forecast successfully logged!"});
                });
            } else {
                return res.status(400).json({error: "There is already a forecast within an hour of the set date!"})
            }
        });
    });
});

// Get all forecasts
app.post('/forecast/admin', (req, res) => {
    const {luid, dateFrom, dateTo, location} = req.body;

    pool.query("SELECT * FROM users WHERE id = ?", [luid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }
        
        if (results.length == 0) {
            return res.status(400).json({error: "No such user for request"})
        }
        
        if (results[0].role != "admin") {
            return res.status(403).json({error: "You don't have permission to view all forecasts!"});
        }

        pool.query("SELECT * FROM weather WHERE location = ? AND date BETWEEN ? AND ?", [location, dateFrom, dateTo], (error1, results1) => {
            if (error1) {
                return res.status(500).json({error: "Database query error"});
            }

            if (results1.length == 0) {
                return res.status(400).json({error: "No records for this datetime within approx. an hour!"});
            }

            return res.status(200).json(results1);
        });
    });
    
});

// User and guest weather endpoints

// Get forecast for guest by location
app.post('/forecast/guest', (req, res) => {
    const {datetime, location} = req.body;

    pool.query("SELECT location, temp_min, temp_max, weather_type, precipitation FROM weather WHERE location = ? AND date BETWEEN DATEADD(SECOND,-3599,?) AND DATEADD(SECOND,3599,?)", [location, datetime, datetime], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.length == 0) {
            return res.status(400).json({error: "No records for this datetime within approx. an hour!"});
        }

        return res.status(200).json(results);
    });
});

// Get forecast for user by location
app.post('/forecast/user', (req, res) => {
    const {luid, datetime, location} = req.body;

    pool.query("SELECT * FROM users WHERE id = ?", [luid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }
        
        if (results.length == 0) {
            return res.status(400).json({error: "No such user for request"})
        }

        pool.query("SELECT date, location, temp_min, temp_max, weather_type, precipitation, precipitation_prob, wind_speed, wind_direction, humidity, pressure, uv_index FROM weather WHERE location = ? AND date BETWEEN DATEADD(SECOND,-3599,?) AND DATEADD(SECOND,3599,?)", [location, datetime, datetime], (error1, results1) => {
            if (error1) {
                return res.status(500).json({error: "Database query error"});
            }

            if (results1.length == 0) {
                return res.status(400).json({error: "No records for this datetime within approx. an hour!"});
            }

            return res.status(200).json(results1);
        });
    });
});

// Get forecast calendar
app.post('/forecast/user/cal', (req, res) => {
    const {luid, location} = req.body;

    pool.query("SELECT * FROM users WHERE id = ?", [luid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }
        
        if (results.length == 0) {
            return res.status(400).json({error: "No such user for request"})
        }

        pool.query("SELECT date, location, temp_min, temp_max, weather_type, precipitation, precipitation_prob, wind_speed, wind_direction, humidity, pressure, uv_index FROM weather WHERE location = ?", [location, datetime, datetime], (error1, results1) => {
            if (error1) {
                return res.status(500).json({error: "Database query error"});
            }

            if (results1.length == 0) {
                return res.status(400).json({error: "No records for this location"});
            }

            return res.status(200).json(results1);
        });
    });
});

// ADMIN ENDPOINTS -----

// Get all users
app.post('/admin/users', (req, res) => {
    const luid = req.body.luid;

    if (!luid) {
        return res.status(400).json({error: "Missing user identifier"});
    }

    pool.query("SELECT * FROM users WHERE ID=?", [luid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.length == 0) {
            return res.status(400).json({error: "No such user with this ID!"});
        }

        if (results[0].role != "admin") {
            return res.status(403).json({error: "You don't have permission to change user status!"});
        }

        pool.query("SELECT * FROM users", (error1, results1) => {
            if (error1) {
                return res.status(500).json(`Database query error: ${error1.message}`);
            } else {
                return res.status(200).json(results1);
            }
        });
    });
});

// Get specific user
app.get('/admin/:uid', (req, res) => {
    const uid = req.params.uid;

    if (!uid) {
        return res.status(400).json({error: "Missing user identifier"});
    }

    pool.query("SELECT * FROM users WHERE ID=?", [uid], (error, results) => {
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
app.patch('/admin/status', (req, res) => {
    const {uid, luid} = req.body;

    if (!uid || !luid) {
        return res.status(400).json({error: "Missing user identifier"});
    }

    pool.query("SELECT * FROM users WHERE ID=?", [luid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.length == 0) {
            return res.status(400).json({error: "No such user with this ID!"});
        }

        if (results[0].role != "admin") {
            return res.status(403).json({error: "You don't have permission to access this!"});
        }

        pool.query("SELECT * FROM users WHERE ID=?", [uid], (error1, results1) => {
            if (error1) {
                return res.status(500).json({error: "Database query error"});
            }

            if (results1.length == 0) {
                return res.status(200).json({message: "User with this ID does not exist!"});
            }

            pool.query("UPDATE users SET is_active = not is_active WHERE ID=?", [uid], (error2, results2) => {
                if (error2) {
                    return res.status(500).json({error: "Database query error"});
                }

                return res.status(200).json({message: "User status changed!"})
            });
        });
    });
    
});

// Delete user
app.delete('/admin/users', (req, res) => {
    const {uid, luid} = req.body;

    if (!uid || !luid) {
        return res.status(400).json({error: "Missing user identifier"});
    }

    pool.query("SELECT * FROM users WHERE ID=?", [luid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results.length == 0) {
            return res.status(400).json({error: "No such user with this ID!"});
        }

        if (results[0].role != "admin") {
            return res.status(403).json({error: "You don't have permission to access this!"});
        }

        pool.query("SELECT * FROM users WHERE ID=?", [uid], (error1, results1) => {
            if (error1) {
                return res.status(500).json({error: "Database query error"});
            }

            if (results1.length == 0) {
                return res.status(200).json({message: "User with this ID does not exist!"});
            }

            pool.query("DELETE FROM users WHERE ID=?", [uid], (error2, results2) => {
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

// --- START LISTENING ---

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});