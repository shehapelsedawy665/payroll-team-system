package handlers

import (
	"context"
	"net/http"
	"time"

	"your-project-name/database"
	"your-project-name/models"
	"your-project-name/pkg/calculations" // تأكد من المسار الصحيح للباكج

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
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

	companyIdStr := c.Locals("companyId").(string)
	compID, _ := primitive.ObjectIDFromHex(companyIdStr)
	empID, _ := primitive.ObjectIDFromHex(req.EmpID)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// 2. جلب بيانات الموظف والشركة بالتوازي (Optimization)
	empCol := database.DB.Collection("employees")
	compCol := database.DB.Collection("companies")

	var emp models.Employee
	var company models.Company

	// جلب الموظف (تأكد إنه تابع لنفس الشركة)
	err := empCol.FindOne(ctx, bson.M{"_id": empID, "companyId": compID}).Decode(&emp)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "الموظف غير موجود أو غير تابع للشركة"})
	}

	// جلب إعدادات الشركة (أو استخدام القيم الافتراضية)
	_ = compCol.FindOne(ctx, bson.M{"_id": compID}).Decode(&company)
	settings := company.Settings
	if settings.MaxInsSalary == 0 {
		settings.PersonalExemption = 20000
		settings.MaxInsSalary = 16700
		settings.InsEmployeePercent = 0.11
	}

	// 3. تشغيل المحرك المالي (pkg/calculations)
	// نقوم بتعديل بيانات الراتب مؤقتاً بناءً على مدخلات المستخدم في الـ UI
	calcInput := emp
	if req.FullBasic > 0 {
		calcInput.SalaryDetails.BasicSalary = req.FullBasic
	}

	// استدعاء وظيفة الحساب من الباكج اللي عملناها في Go
	calcResult := calculations.CalculateEgyptianPayroll(calcInput, settings, req.Days, req.Additions, req.Deductions)

	// 4. تجهيز عنصر الهيستوري (History Item)
	historyItem := bson.M{
		"month": req.Month,
		"payload": bson.M{
			"grossSalary":       calcResult.GrossSalary,
			"netSalary":         calcResult.NetSalary,
			"taxAmount":         calcResult.TaxAmount,
			"insuranceEmployee": calcResult.InsuranceEmployee,
			"days":              req.Days,
			"createdAt":         time.Now(),
		},
	}

	// 5. الحفظ الذكي (Update/Overwrite)
	// أولاً: مسح أي سجل قديم لنفس الشهر (لعدم التكرار)
	_, _ = empCol.UpdateOne(ctx, bson.M{"_id": empID}, bson.M{"$pull": bson.M{"history": bson.M{"month": req.Month}}})

	// ثانياً: إضافة السجل الجديد
	_, err = empCol.UpdateOne(ctx, bson.M{"_id": empID}, bson.M{"$push": bson.M{"history": historyItem}})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "فشل في تحديث سجل الموظف"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم حفظ مرتب شهر " + req.Month + " بنجاح ✅",
		"result":  calcResult,
	})
}

// NetToGrossCalculator الحاسبة السريعة
func NetToGrossCalculator(c *fiber.Ctx) error {
	type NetRequest struct {
		TargetNet float64 `json:"targetNet"`
	}
	var req NetRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "يرجى إدخال المبلغ الصافي"})
	}

	// هنا بنستخدم معادلة تقريبية أو الـ Reverse logic لو كنت عملته في calculations.go
	// للتبسيط حالياً هنستخدم نفس المنطق التقريبي لـ Node.js
	gross := req.TargetNet * 1.4 // مثال

	return c.JSON(fiber.Map{
		"targetNet":   req.TargetNet,
		"grossSalary": gross,
		"message":     "حساب تقريبي - قيد التطوير الدقيق",
	})
}
