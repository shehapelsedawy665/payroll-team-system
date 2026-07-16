const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');

// إضافة موظف جديد
router.post('/', async (req, res) => {
    try {
        const newEmployee = new Employee(req.body);
        await newEmployee.save();
        res.status(201).json({ success: true, message: "تم تسجيل الموظف بنجاح", data: newEmployee });
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ أثناء تسجيل الموظف", error: error.message });
    }
});

// جلب الموظفين لشركة معينة
router.get('/company/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        const employees = await Employee.find({ companyId });
        res.status(200).json({ success: true, data: employees });
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ في جلب الموظفين", error: error.message });
    }
});

module.exports = router;
