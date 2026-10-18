const express = require('express');
const router = express.Router();

var db = require('../utils/database');

// Admin weather endpoints ---

// Create forecast
router.post('/', (req, res) => {
    // data needs to have: data.date, data.loc, data.tMin, data.tMax, data.weaType, data.prec, data.precProb, data.windSpeed, data.windDir, data.humid, data.press, data.uv
    const {data, luid} = req.body;

    if (!data || !luid ) {
        return res.status(400).json({error: "Missing required fields"});
    }

    db.query("SELECT role FROM users WHERE id = ?", [luid], (error, results) => {
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
        db.query("SELECT * FROM weather WHERE date = ?", [data.date], (error1, results1) => {
            if (error1) {
                return res.status(500).json({error: "Database query error"});
            }

            if (results1.length == 0) {
                db.query("INSERT INTO weather (date, location, temp_min, temp_max, weather_type, precipitation, precipitation_prob, wind_speed, wind_direction, humidity, pressure, uv_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [data.date, data.loc, data.tMin, data.tMax, data.weaType, data.prec, data.precProb, data.windSpeed, data.windDir, data.humid, data.press, data.uv], (error1, _results) => {
                    if (error1) {
                        return res.status(500).json(`Database query error: ${error1}`);
                    }

                    return res.status(200).json({message: "Weather forecast successfully logged!"});
                });
            } else {
                return res.status(400).json({error: "There is already a forecast on that date!"})
            }
        });
    });
});

// Get all forecasts
router.post('/admin', (req, res) => {
    const {luid, location} = req.body;

    if (!luid) {
        return res.status(400).json({error: "Missing required fields"});
    }

    db.query("SELECT * FROM users WHERE id = ?", [luid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }
        
        if (results.length == 0) {
            return res.status(400).json({error: "No such user for request"});
        }
        
        if (results[0].role != "admin") {
            return res.status(403).json({error: "You don't have permission to view all forecasts!"});
        }

        if (location) {
            db.query("SELECT * FROM weather WHERE location = ? ORDER BY date DESC", [location], (error1, results1) => {
                if (error1) {
                    return res.status(500).json({error: "Database query error"});
                }

                if (results1.length == 0) {
                    return res.status(400).json({error: "No records for this location!"});
                }

                return res.status(200).json(results1);
            });
        } else {
            db.query("SELECT * FROM weather", (error1, results1) => {
                if (error1) {
                    return res.status(500).json({error: "Database query error"});
                }

                if (results1.length == 0) {
                    return res.status(400).json({error: "No records at all!"});
                }

                return res.status(200).json(results1);
            });
        }
    });
    
});

// Edit forecast
router.patch('/', (req, res) => {
    // data needs to have: data.date, data.loc, data.tMin, data.tMax, data.weaType, data.prec, data.precProb, data.windSpeed, data.windDir, data.humid, data.press, data.uv
    const {forecastID, luid, data} = req.body;

    if (!forecastID || !luid || !data) {
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

        db.query("SELECT * FROM weather WHERE ID=?", [forecastID], (error1, results1) => {
            if (error1) {
                return res.status(500).json({error: "Database query error"});
            }

            if (results1.length == 0) {
                return res.status(200).json({message: "Weather forecast with this ID doesn't exist"});
            }
            
            db.query("SELECT * FROM weather WHERE date=? && location=?", [data.date, data.loc], (err, result) => {
                if (err) {
                    return res.status(500).json({error: "Database query error"});
                }

                if (result.length > 0) {
                    if (result[0].ID != forecastID) {
                        return res.status(400).json({message: "A forecast already exists on that date!"});
                    }
                }

                db.query("UPDATE weather SET date=?, location=?, temp_min=?, temp_max=?, weather_type=?, precipitation=?, precipitation_prob=?, wind_speed=?, wind_direction=?, humidity=?, pressure=?, uv_index=? WHERE ID=?", [data.date, data.loc, data.tMin, data.tMax, data.weaType, data.prec, data.precProb, data.windSpeed, data.windDir, data.humid, data.press, data.uv, forecastID], (error2, results2) => {
                    if (error2) {
                        return res.status(500).json({error: "Database query error"});
                    }

                    if (results2.affectedRows == 1) {
                        return res.status(200).json({message: "Weather forecast updated successfully!"});
                    }
                });
            });
        });
    });
});

// Delete forecast
router.delete('/', (req, res) => {
    const {forecastID, luid} = req.body;

    if (!forecastID || !luid) {
        return res.status(400).json({error: "Missing identifiers"});
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

        db.query("SELECT * FROM weather WHERE ID=?", [forecastID], (error1, results1) => {
            if (error1) {
                return res.status(500).json({error: "Database query error"});
            }

            if (results1.length == 0) {
                return res.status(200).json({message: "Weather forecast with this ID doesn't exist"});
            }

            db.query("DELETE FROM weather WHERE ID=?", [forecastID], (error2, results2) => {
                if (error2) {
                    return res.status(500).json({error: "Database query error"});
                }

                if (results2.affectedRows == 1) {
                    return res.status(200).json({message: "Weather forecast deleted successfully!"})
                }
            });
        });
    });
});

// User and guest weather endpoints ---

// Get forecast for guest by location
router.post('/guest', (req, res) => {
    const {datetime, location} = req.body;

    if (!datetime || !location) {
        return res.status(400).json({error: "Missing identifiers"});
    }

    db.query("SELECT date, location, temp_min, temp_max, weather_type, precipitation FROM weather WHERE location = ? AND date BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY)", [location, datetime, datetime], (error, results) => {
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
router.post('/user', (req, res) => {
    const {luid, datetime, location} = req.body;

    if (!luid || !datetime || !location) {
        return res.status(400).json({error: "Missing identifiers"});
    }

    db.query("SELECT * FROM users WHERE id = ?", [luid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }
        
        if (results.length == 0) {
            return res.status(400).json({error: "No such user for request"});
        }

        db.query("SELECT date, location, temp_min, temp_max, weather_type, precipitation, precipitation_prob, wind_speed, wind_direction, humidity, pressure, uv_index FROM weather WHERE location = ? AND date BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY)", [location, datetime, datetime], (error1, results1) => {
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

// Get forecast calendar for user
router.post('/user/calendar', (req, res) => {
    const {luid, location} = req.body;

    if (!location || !luid) {
        return res.status(400).json({error: "Missing identifiers"});
    }

    db.query("SELECT * FROM users WHERE id = ?", [luid], (error, results) => {
        if (error) {
            return res.status(500).json({error: "Database query error"});
        }
        
        if (results.length == 0) {
            return res.status(400).json({error: "No such user for request"});
        }

        db.query("SELECT date, location, temp_min, temp_max, weather_type, precipitation, precipitation_prob, wind_speed, wind_direction, humidity, pressure, uv_index FROM weather WHERE location = ?", [location], (error1, results1) => {
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

// Get forecast calendar for user
router.post('/guest/calendar', (req, res) => {
    const location = req.body.location;

    if (!location) {
        return res.status(400).json({error: "Missing identifiers"});
    }

    db.query("SELECT date, location, temp_min, temp_max, weather_type, precipitation FROM weather WHERE location = ?", [location], (error1, results1) => {
        if (error1) {
            return res.status(500).json({error: "Database query error"});
        }

        if (results1.length == 0) {
            return res.status(400).json({error: "No records for this location"});
        }

        return res.status(200).json(results1);
    });
});

module.exports = router;