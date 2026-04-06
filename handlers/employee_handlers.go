package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"your-project/database" // استبدل your-project باسم المديول بتاعك
	"your-project/models"
)

// 1. إضافة موظف جديد (POST /api/employees)
func CreateEmployee(c *fiber.Ctx) error {
	collection := database.GetCollection("employees")
	
	var emp models.Employee
	if err := c.BodyParser(&emp); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "بيانات غير صالحة"})
	}

	// التأكد من البيانات الأساسية
	if emp.Name == "" || emp.NationalID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "الاسم والرقم القومي بيانات إجبارية"})
	}

	// إعداد البيانات التلقائية
	emp.ID = primitive.NewObjectID()
	// نفترض أن الـ companyId جاي من الـ Middleware (Locals)
	companyIDStr := c.Locals("companyId").(string)
	emp.CompanyID, _ = primitive.ObjectIDFromHex(companyIDStr)
	emp.CreatedAt = time.Now()
	if emp.HireDate.IsZero() {
		emp.HireDate = time.Now()
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := collection.InsertOne(ctx, emp)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return c.Status(400).JSON(fiber.Map{"error": "عفواً، الرقم القومي مسجل مسبقاً"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "خطأ في حفظ البيانات"})
	}

	return c.Status(201).JSON(fiber.Map{
		"success":  true,
		"message":  "تم تسجيل الموظف بنجاح",
		"employee": emp,
	})
}

// 2. جلب قائمة الموظفين (GET /api/employees)
func GetEmployees(c *fiber.Ctx) error {
	collection := database.GetCollection("employees")
	companyIDStr := c.Locals("companyId").(string)
	companyID, _ := primitive.ObjectIDFromHex(companyIDStr)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{"companyId": companyID}
	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "فشل في جلب الموظفين"})
	}
	defer cursor.Close(ctx)

	var employees []models.Employee
	if err = cursor.All(ctx, &employees); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "خطأ في معالجة البيانات"})
	}

	// لو المصفوفة فاضية نرجع [] بدل null عشان الـ Frontend
	if employees == nil {
		employees = []models.Employee{}
	}

	return c.JSON(employees)
}

// 3. جلب تفاصيل موظف (GET /api/employees/:id/details)
func GetEmployeeDetails(c *fiber.Ctx) error {
	collection := database.GetCollection("employees")
	id, _ := primitive.ObjectIDFromHex(c.Params("id"))
	companyIDStr := c.Locals("companyId").(string)
	companyID, _ := primitive.ObjectIDFromHex(companyIDStr)

	var emp models.Employee
	filter := bson.M{"_id": id, "companyId": companyID}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := collection.FindOne(ctx, filter).Decode(&emp)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "الموظف غير موجود"})
	}

	return c.JSON(fiber.Map{
		"emp":     emp,
		"history": emp.History,
	})
}

// 4. حذف موظف (DELETE /api/employees/:id)
func DeleteEmployee(c *fiber.Ctx) error {
	collection := database.GetCollection("employees")
	id, _ := primitive.ObjectIDFromHex(c.Params("id"))
	companyIDStr := c.Locals("companyId").(string)
	companyID, _ := primitive.ObjectIDFromHex(companyIDStr)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"_id": id, "companyId": companyID}
	result, err := collection.DeleteOne(ctx, filter)
	if err != nil || result.DeletedCount == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "فشل الحذف أو الموظف غير موجود"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "تم حذف الموظف بنجاح"})
}
