package handlers

import (
	"context"
	"net/http"
	"time"

	"your-project-name/database"
	"your-project-name/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AddDepartment إضافة قسم جديد وربطه بالشركة أوتوماتيكياً
func AddDepartment(c *fiber.Ctx) error {
	// 1. استخراج companyId من التوكن (عن طريق Middleware)
	companyIdStr := c.Locals("companyId").(string)
	objID, _ := primitive.ObjectIDFromHex(companyIdStr)

	var dept models.Department
	if err := c.BodyParser(&dept); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "بيانات القسم غير صالحة"})
	}

	// 2. التحقق من البيانات الأساسية
	if dept.Name == "" || dept.Code == "" {
		return c.Status(400).JSON(fiber.Map{"error": "الاسم والكود مطلوبان"})
	}

	// ربط القسم بالشركة
	dept.CompanyID = objID
	dept.CreatedAt = time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := database.DB.Collection("departments")
	result, err := collection.InsertOne(ctx, dept)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "فشل في حفظ القسم"})
	}

	// إرجاع الـ ID الجديد مع البيانات
	dept.ID = result.InsertedID.(primitive.ObjectID)

	return c.Status(201).JSON(fiber.Map{
		"message":    "تم إضافة القسم بنجاح ✅",
		"department": dept,
	})
}

// GetAllDepartments جلب كل أقسام الشركة الحالية فقط
func GetAllDepartments(c *fiber.Ctx) error {
	// استخراج companyId من التوكن
	companyIdStr := c.Locals("companyId").(string)
	objID, _ := primitive.ObjectIDFromHex(companyIdStr)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := database.DB.Collection("departments")
	
	// الفلترة بناءً على الـ CompanyID لضمان الخصوصية
	filter := bson.M{"companyId": objID}
	
	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "خطأ في جلب الأقسام"})
	}
	defer cursor.Close(ctx)

	var departments []models.Department
	if err = cursor.All(ctx, &departments); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "خطأ في معالجة البيانات"})
	}

	// لو المصفوفة فاضية نرجع لستة فاضية بدل null
	if departments == nil {
		departments = []models.Department{}
	}

	return c.JSON(departments)
}
