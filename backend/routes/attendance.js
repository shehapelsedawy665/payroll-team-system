const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');

/**
 * 1. إضافة سجل حضور/غياب جديد (يدوي من الـ HR أو أوتوماتيك من ماكنة البصمة)
 * المسار: POST /api/attendance
 */
router.post('/', async (req, res) => {
    try {
        const attendanceData = req.body;
        
        // التأكد إن مفيش سجل لنفس الموظف في نفس اليوم عشان الحسابات متضربش
        const existingRecord = await Attendance.findOne({
            employeeId: attendanceData.employeeId,
            date: attendanceData.date
        });

        if (existingRecord) {
            return res.status(400).json({ 
                success: false, 
                message: "اليوم ده متسجل للموظف ده قبل كده، تقدر تعدله بس مينفعش تضيفه من تاني." 
            });
        }

        const newRecord = new Attendance(attendanceData);
        await newRecord.save();

        res.status(201).json({
            success: true,
            message: "تم حفظ سجل الحضور بنجاح",
            data: newRecord
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ أثناء حفظ السجل", error: error.message });
    }
});

/**
 * 2. عرض سجلات الحضور لموظف معين في شهر معين (عشان تظهر في بروفايله)
 * المسار: GET /api/attendance/employee/:employeeId?month=5&year=2026
 */
router.get('/employee/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { month, year } = req.query; 

        // تظبيط التاريخ عشان نجيب من أول يوم في الشهر لآخر يوم
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const records = await Attendance.find({
            employeeId,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 }); // ترتيب بالأيام

        res.status(200).json({
            success: true,
            count: records.length,
            data: records
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ في استرجاع بيانات الحضور", error: error.message });
    }
});

/**
 * 3. عرض كل سجلات الشركة في يوم معين (عشان الـ HR يراجع مين غايب النهاردة)
 * المسار: GET /api/attendance/company/:companyId?date=2026-05-20
 */
router.get('/company/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        const { date } = req.query;

        // تحديد بداية ونهاية اليوم المطلوب
        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

        const records = await Attendance.find({
            companyId,
            date: { $gte: startOfDay, $lte: endOfDay }
        }).populate('employeeId', 'name jobId department'); // نجيب اسم الموظف ورقمه الوظيفي مع السجل

        res.status(200).json({
            success: true,
            count: records.length,
            data: records
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ في استرجاع سجلات الشركة", error: error.message });
    }
});

module.exports = router;
