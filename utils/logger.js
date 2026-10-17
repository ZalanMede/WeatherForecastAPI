const winston = require('winston');
 
const logFormat = winston.format.printf(( { timestamp, level, message } ) => {
    return `[${timestamp}] ${level}: ${message}`
});
 
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm' }),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        }),
        new winston.transports.File({
            filename: 'server.log',
            format: logFormat
        })
    ]
});
 
module.exports = logger;