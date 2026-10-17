require('dotenv').config({url: __dirname + '/../.env'});

var mysql = require('mysql');
const logger = require('./logger');

var pool  = mysql.createPool({
    connectionLimit : process.env.DB_CONN_LIMIT,
    host            : process.env.DB_HOST,
    user            : process.env.DB_USER,
    password        : process.env.DB_PASS,
    port            : process.env.DB_PORT,
    database        : process.env.DB_NAME,
    timezone        : process.env.DB_TIMEZONE
});

function query(sql, params, callback) {
    const DEBUG = process.env.APP_DEBUG_MODE === 'true';

    const startTime = Date.now();

    if (typeof params === 'function') {
        callback = params;
        params = [];
    }

    pool.query(sql, params, (error, results) =>{
        if (error) {
            if (DEBUG) {
                logger.error(`Database query error: ${error.message}`);
            }
            return callback(error, null);
        }
        
        if (DEBUG) {
            const endTime = Date.now();
            const executionTime = endTime - startTime;

            const count = Array.isArray(results) ? results.length : results.affectedRows;
            const txt = Array.isArray(results) ? 'record(s) sent' : 'record(s) affected';

            logger.info(`Database query successful: ${sql} -> ${count} ${txt} (${executionTime} ms)`);
        }

        return callback(null, results);
    });
}

module.exports = { query };