const { body, validationResult } = require('express-validator');

const validateEmployee = [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('nationalId').trim().matches(/^\d{14}$/),
    body('hiringDate').isISO8601(),
    body('insSalary').isFloat({ min: 0, max: 20000 }),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        next();
    }
];

module.exports = { validateEmployee };