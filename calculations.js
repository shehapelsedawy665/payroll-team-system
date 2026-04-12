/**
 * calculations.js — Root-level bridge
 * server.js requires './calculations', so this file re-exports
 * the payroll engine from backend/logic/payrollEngine.js
 */
module.exports = require('./backend/logic/payrollEngine');
