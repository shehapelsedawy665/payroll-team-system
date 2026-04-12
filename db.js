/**
 * db.js — Root-level bridge
 * server.js requires './db', so this file re-exports everything
 * from the actual database module at backend/config/db.js
 */
module.exports = require('./backend/config/db');
