// api/auth.js
const { connectDB } = require('../backend/config/db');
const User = require('../backend/models/User');
const Company = require('../backend/models/Company');

module.exports = async (req, res) => {
    await connectDB();
    const { method } = req;

    if (method === 'POST') {
        const { action, email, password, companyName, masterKey } = req.body;

        // --- [1] الـ Secret Sign-up (ليك أنت بس كـ Vendor) ---
        if (action === 'master-init') {
            // الأمان هنا: بنقارن الـ Key اللي جاي من الـ Shortcut باللي مخبينه في Vercel
            // الـ Key ده هو: CO.Sedawy.2026
            if (masterKey !== process.env.MASTER_SECRET_KEY) {
                return res.status(403).json({ success: false, message: "صلاحيات غير كافية!" });
            }

            try {
                // إنشاء الشركة الجديدة
                const newCompany = await Company.create({ name: companyName });
                
                // إنشاء أول Admin للشركة دي
                const adminUser = await User.create({
                    email,
                    password, // يفضل تشفيرها مستقبلاً
                    role: 'admin',
                    companyId: newCompany._id
                });

                return res.status(201).json({ success: true, message: "تم تفعيل نظام الشركة بنجاح!", adminUser });
            } catch (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
        }

        // --- [2] تسجيل الدخول العادي (للـ HR والموظفين) ---
        if (action === 'login') {
            const user = await User.findOne({ email }).populate('companyId');
            if (!user || user.password !== password) {
                return res.status(401).json({ success: false, message: "بيانات الدخول خطأ" });
            }
            return res.status(200).json({ success: true, user });
        }
    }

    res.status(405).json({ message: "Method Not Allowed" });
};
