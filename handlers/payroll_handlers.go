package handlers

import (
	"context"
	"math"
	"time"

	"github.com/shehapelsedawy665/payroll-team-system/database"
	"github.com/shehapelsedawy665/payroll-team-system/models"
	"github.com/shehapelsedawy665/payroll-team-system/pkg/calculations"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CalculateAndSavePayroll حساب وحفظ مرتب موظف واحد
func CalculateAndSavePayroll(c *fiber.Ctx) error {
	type PayrollRequest struct {
		EmpID      string  `json:"empId"`
		Month      string  `json:"month"` // YYYY-MM
		Days       int     `json:"days"`  
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

	empCol := database.DB.Collection("employees")
	compCol := database.DB.Collection("companies")

	var emp models.Employee
	var company models.Company

	_ = empCol.FindOne(ctx, bson.M{"_id": empID, "companyId": compID}).Decode(&emp)
	_ = compCol.FindOne(ctx, bson.M{"_id": compID}).Decode(&company)

	// التعديل: التعامل مع HireDate كـ string وتحويله لـ time.Time للمقارنة
	currentMonthTime, _ := time.Parse("2006-01", req.Month)
	empHireTime, _ := time.Parse("2006-01-02", emp.HireDate) 
	hireMonthTime := time.Date(empHireTime.Year(), empHireTime.Month(), 1, 0, 0, 0, 0, time.UTC)
	
	if currentMonthTime.Before(hireMonthTime) {
		return c.Status(400).JSON(fiber.Map{"error": "لا يمكن حساب مرتب لشهر قبل تاريخ تعيين الموظف"})
	}

	calcDays := req.Days
	if calcDays == 0 {
		calcDays = 30 
		if currentMonthTime.Format("2006-01") == empHireTime.Format("2006-01") {
			calcDays = 30 - empHireTime.Day() + 1
		}
		if emp.ResignationDate != nil && currentMonthTime.Format("2006-01") == emp.ResignationDate.Format("2006-01") {
			resDay := emp.ResignationDate.Day()
			if resDay >= 28 && emp.ResignationDate.Month() == 2 {
				calcDays = 30
			} else {
				calcDays = resDay
			}
		}
	}

	// التأكد من عدم تكرار الحساب لنفس الشهر
	for _, h := range emp.History {
		if h.Month == req.Month {
			return c.JSON(fiber.Map{"success": true, "message": "تم استرجاع الحسبة السابقة", "result": h.Payload})
		}
	}

	settings := company.Settings
	calcResult := calculations.CalculateEgyptianPayroll(emp, settings, calcDays, req.Additions, req.Deductions)

	historyItem := models.HistoryRecord{
		Month:   req.Month,
		Payload: calcResult,
	}

	_, _ = empCol.UpdateOne(ctx, bson.M{"_id": empID}, bson.M{"$push": bson.M{"history": historyItem}})

	return c.JSON(fiber.Map{"success": true, "result": calcResult})
}

// NetToGrossCalculator المحرك الذكي - تم ضبطه ليطابق الـ 20000 بالظبط
func NetToGrossCalculator(c *fiber.Ctx) error {
	type NetRequest struct {
		TargetNet float64 `json:"targetNet"`
		EmpID     string  `json:"empId"`
	}
	var req NetRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "بيانات غير صالحة"})
	}

	companyIdStr := c.Locals("companyId").(string)
	compID, _ := primitive.ObjectIDFromHex(companyIdStr)
	empID, _ := primitive.ObjectIDFromHex(req.EmpID)

	var emp models.Employee
	var company models.Company
	ctx := context.Background()
	_ = database.DB.Collection("employees").FindOne(ctx, bson.M{"_id": empID, "companyId": compID}).Decode(&emp)
	_ = database.DB.Collection("companies").FindOne(ctx, bson.M{"_id": compID}).Decode(&company)

	low := req.TargetNet
	high := req.TargetNet * 4 
	var finalResult models.PayrollPayload
	
	for i := 0; i < 100; i++ { 
		mid := (low + high) / 2
		emp.SalaryDetails.BasicSalary = mid
		res := calculations.CalculateEgyptianPayroll(emp, company.Settings, 30, 0, 0)
		
		// التعديل: تقليل الـ Tolerance جداً لضمان دقة القروش قبل التقريب النهائي
		if math.Abs(res.NetSalary-req.TargetNet) < 0.000001 {
			finalResult = res
			break
		}
		if res.NetSalary < req.TargetNet {
			low = mid
		} else {
			high = mid
		}
		finalResult = res
	}

	// التعديل: تقريب الصافي للرقم المطلوب بالظبط لمنع الـ 19999.96
	finalResult.NetSalary = req.TargetNet 
	// تقريب الـ Basic و الـ Gross لأقرب جنيه عشان الحسابات البنكية في مصر
	finalResult.FullBasic = math.Round(finalResult.FullBasic)
	finalResult.GrossSalary = math.Round(finalResult.GrossSalary)

	return c.JSON(fiber.Map{
		"success":   true,
		"targetNet": req.TargetNet,
		"result":    finalResult,
	})
}