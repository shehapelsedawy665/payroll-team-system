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

// CalculateAndSavePayroll حساب وحفظ مرتب موظف واحد لشهر معين
func CalculateAndSavePayroll(c *fiber.Ctx) error {
	type PayrollRequest struct {
		EmpID      string  `json:"empId"`
		Month      string  `json:"month"` 
		Days       int     `json:"days"`
		FullBasic  float64 `json:"fullBasic"`
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

	// التأكد من تسلسل الشهور
	if len(emp.History) > 0 {
		lastRecord := emp.History[len(emp.History)-1]
		lastMonth, _ := time.Parse("2006-01", lastRecord.Month)
		currentMonth, _ := time.Parse("2006-01", req.Month)

		for _, h := range emp.History {
			if h.Month == req.Month {
				return c.JSON(fiber.Map{
					"success": true,
					"message": "تم استرجاع الحسبة المسجلة مسبقاً لهذا الشهر",
					"result":  h.Payload,
				})
			}
		}

		if currentMonth.After(lastMonth.AddDate(0, 1, 0)) {
			return c.Status(400).JSON(fiber.Map{"error": "يجب حساب الشهور بالترتيب، يرجى حساب الشهر السابق أولاً"})
		}
	}

	settings := company.Settings
	calcResult := calculations.CalculateEgyptianPayroll(emp, settings, req.Days, req.Additions, req.Deductions)

	historyItem := models.HistoryRecord{
		Month:   req.Month,
		Payload: calcResult,
	}

	_, _ = empCol.UpdateOne(ctx, bson.M{"_id": empID}, bson.M{"$pull": bson.M{"history": bson.M{"month": req.Month}}})
	_, err := empCol.UpdateOne(ctx, bson.M{"_id": empID}, bson.M{"$push": bson.M{"history": historyItem}})
	
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "فشل حفظ السجل"})
	}

	return c.JSON(fiber.Map{"success": true, "result": calcResult})
}

// NetToGrossCalculator المحرك الذكي
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
	high := req.TargetNet * 2 
	var finalGross float64
	
	for i := 0; i < 50; i++ { 
		mid := (low + high) / 2
		emp.SalaryDetails.BasicSalary = mid
		res := calculations.CalculateEgyptianPayroll(emp, company.Settings, 30, 0, 0)
		
		if math.Abs(res.NetSalary-req.TargetNet) < 0.01 {
			finalGross = mid
			break
		}
		if res.NetSalary < req.TargetNet {
			low = mid
		} else {
			high = mid
		}
		finalGross = mid
	}

	return c.JSON(fiber.Map{
		"targetNet":   req.TargetNet,
		"grossSalary": math.Round(finalGross*100) / 100,
		"message":     "تم حساب الـ Gross بدقة متناهية ✅",
	})
}
