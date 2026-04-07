package handlers

import (
	"context"
	"time"

	// التعديل الجوهري للمسارات بناءً على الموديول بتاعك
	"github.com/shehapelsedawy665/payroll-system/database"
	"github.com/shehapelsedawy665/payroll-system/models"
	"github.com/shehapelsedawy665/payroll-system/pkg/calculations"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CalculateAndSavePayroll حساب وحفظ مرتب موظف واحد لشهر معين
func CalculateAndSavePayroll(c *fiber.Ctx) error {
	// 1. استقبال البيانات من الـ Request
	type PayrollRequest struct {
		EmpID      string  `json:"empId"`
		Month      string  `json:"month"`
		Days       int     `json:"days"`
		FullBasic  float64 `json:"fullBasic"`
		FullTrans  float64 `json:"fullTrans"`
		Additions  float64 `json:"additions"`
		Deductions float64 `json:"deductions"`
	}

	var req PayrollRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "بيانات الطلب غير صالحة"})
	}

	// استخراج IDs من التوكن والطلب
	companyIdStr, ok := c.Locals("companyId").(string)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "غير مصرح لك بالوصول"})
	}
	compID, _ := primitive.ObjectIDFromHex(companyIdStr)
	empID, err := primitive.ObjectIDFromHex(req.EmpID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ID الموظف غير صحيح"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// 2. جلب بيانات الموظف والشركة
	empCol := database.DB.Collection("employees")
	compCol := database.DB.Collection("companies")

	var emp models.Employee
	var company models.Company

	// جلب الموظف (تأكد إنه تابع لنفس الشركة لضمان الخصوصية)
	err = empCol.FindOne(ctx, bson.M{"_id": empID, "companyId": compID}).Decode(&emp)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "الموظف غير موجود أو غير تابع لشركتك"})
	}

	// جلب إعدادات الشركة للحسابات الضريبية (قانون الضرائب المصري 2026)
	_ = compCol.FindOne(ctx, bson.M{"_id": compID}).Decode(&company)
	settings := company.Settings
	
	// قيم افتراضية قانونية لو الإعدادات مش موجودة
	if settings.MaxInsSalary == 0 {
		settings.PersonalExemption = 20000 // الإعفاء الشخصي السنوي
		settings.MaxInsSalary = 16700      // الحد الأقصى للتأمينات 2026
		settings.InsEmployeePercent = 0.11 // حصة الموظف 11%
	}

	// 3. تشغيل المحرك المالي (pkg/calculations)
	// نحدث الراتب الأساسي لو المستخدم عدله في الشاشة
	if req.FullBasic > 0 {
		emp.SalaryDetails.BasicSalary = req.FullBasic
	}

	// استدعاء الوظيفة الحسابية (تأكد إن اسم الدالة في pkg صح)
	calcResult := calculations.CalculateEgyptianPayroll(emp, settings, req.Days, req.Additions, req.Deductions)

	// 4. تجهيز سجل الهيستوري (History Item) لـ MongoDB
	historyItem := bson.M{
		"month": req.Month,
		"payload": bson.M{
			"grossSalary":       calcResult.GrossSalary,
			"netSalary":         calcResult.NetSalary,
			"taxAmount":         calcResult.TaxAmount,
			"insuranceEmployee": calcResult.InsuranceEmployee,
			"days":              req.Days,
			"additions":         req.Additions,
			"deductions":        req.Deductions,
			"createdAt":         time.Now(),
		},
	}

	// 5. الحفظ الذكي (Update/Overwrite)
	// أولاً: حذف أي سجل قديم لنفس الشهر عشان نمنع الدوبليكيت
	_, _ = empCol.UpdateOne(ctx, 
		bson.M{"_id": empID}, 
		bson.M{"$pull": bson.M{"history": bson.M{"month": req.Month}}},
	)

	// ثانياً: إضافة السجل الجديد في المصفوفة
	_, err = empCol.UpdateOne(ctx, 
		bson.M{"_id": empID}, 
		bson.M{"$push": bson.M{"history": historyItem}},
	)
	
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "فشل في تحديث سجل رواتب الموظف"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم حساب وحفظ مرتب شهر " + req.Month + " بنجاح ✅",
		"result":  calcResult,
	})
}

// NetToGrossCalculator حاسبة تحويل الصافي لإجمالي (Reverse Calculator)
func NetToGrossCalculator(c *fiber.Ctx) error {
	type NetRequest struct {
		TargetNet float64 `json:"targetNet"`
	}
	var req NetRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "يرجى إدخال المبلغ الصافي"})
	}

	// معادلة تقريبية لحين تفعيل الـ Logic الدقيق في pkg
	gross := req.TargetNet * 1.35 

	return c.JSON(fiber.Map{
		"targetNet":   req.TargetNet,
		"grossSalary": gross,
		"message":     "هذا حساب تقريبي، جاري تطوير المحرك الدقيق",
	})
}
