package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

	// التعديل الصحيح للمسارات بناءً على go.mod الخاص بك
	"github.com/shehapelsedawy665/payroll-system/database"
	"github.com/shehapelsedawy665/payroll-system/models"
)

// 1. إضافة موظف جديد (POST /api/employees)
func CreateEmployee(c *fiber.Ctx) error {
	// الوصول للـ Collection مباشرة من قاعدة البيانات المتصلة
	collection := database.DB.Collection("employees")
	
	var emp models.Employee
	if err := c.BodyParser(&emp); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "بيانات الموظف غير صالحة"})
	}

	// التأكد من البيانات الأساسية
	if emp.Name == "" || emp.NationalID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "الاسم والرقم القومي بيانات إجبارية"})
	}

	// إعداد البيانات التلقائية
	emp.ID = primitive.NewObjectID()
	
	// استخراج ID الشركة من الـ Middleware (التوكن) لضمان الأمان
	companyIDStr, ok := c.Locals("companyId").(string)
	if !ok || companyIDStr == "" {
		return c.Status(401).JSON(fiber.Map{"error": "غير مصرح لك بالوصول"})
	}
	
	emp.CompanyID, _ = primitive.ObjectIDFromHex(companyIDStr)
	emp.CreatedAt = time.Now()
	
	if emp.HireDate.IsZero() {
		emp.HireDate = time.Now()
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := collection.InsertOne(ctx, emp)
	if err != nil {
		// معالجة حالة تكرار الرقم القومي إذا كان هناك Index فريد
		if mongo.IsDuplicateKeyError(err) {
			return c.Status(400).JSON(fiber.Map{"error": "عفواً، الرقم القومي مسجل مسبقاً لموظف آخر"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "خطأ في حفظ بيانات الموظف"})
	}

	return c.Status(201).JSON(fiber.Map{
		"success":  true,
		"message":  "تم تسجيل الموظف بنجاح ✅",
		"employee": emp,
	})
}

// 2. جلب قائمة الموظفين (GET /api/employees)
func GetEmployees(c *fiber.Ctx) error {
	collection := database.DB.Collection("employees")
	
	companyIDStr, ok := c.Locals("companyId").(string)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "انتهت الجلسة، سجل دخول مجدداً"})
	}
	companyID, _ := primitive.ObjectIDFromHex(companyIDStr)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// فلترة لجلب موظفين هذه الشركة فقط
	filter := bson.M{"companyId": companyID}
	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "فشل في جلب قائمة الموظفين"})
	}
	defer cursor.Close(ctx)

	var employees []models.Employee
	if err = cursor.All(ctx, &employees); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "خطأ في معالجة البيانات المستلمة"})
	}

	// نضمن رجوع مصفوفة فارغة [] بدل null
	if employees == nil {
		employees = []models.Employee{}
	}

	return c.JSON(employees)
}

// 3. جلب تفاصيل موظف محدد (GET /api/employees/:id/details)
func GetEmployeeDetails(c *fiber.Ctx) error {
	collection := database.DB.Collection("employees")
	
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ID الموظف غير صحيح"})
	}

	companyIDStr := c.Locals("companyId").(string)
	companyID, _ := primitive.ObjectIDFromHex(companyIDStr)

	var emp models.Employee
	// التحقق من ID الموظف وتبعيتة للشركة في نفس الوقت لزيادة الأمان
	filter := bson.M{"_id": id, "companyId": companyID}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = collection.FindOne(ctx, filter).Decode(&emp)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "عفواً، الموظف غير موجود أو تم حذفه"})
	}

	return c.JSON(fiber.Map{
		"emp":     emp,
		"history": emp.History,
	})
}

// 4. حذف موظف (DELETE /api/employees/:id)
func DeleteEmployee(c *fiber.Ctx) error {
	collection := database.DB.Collection("employees")
	
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ID الموظف غير صحيح"})
	}

	companyIDStr := c.Locals("companyId").(string)
	companyID, _ := primitive.ObjectIDFromHex(companyIDStr)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"_id": id, "companyId": companyID}
	result, err := collection.DeleteOne(ctx, filter)
	if err != nil || result.DeletedCount == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "فشل الحذف، الموظف قد لا يكون موجوداً أو لا يتبع لشركتك"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "تم حذف الموظف بنجاح من النظام"})
}
