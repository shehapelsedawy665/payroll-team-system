package handlers

import (
	"context"
	"time"

	// التعديل الجوهري: ربط المسارات باسم الموديول الصحيح لمشروعك
	"github.com/shehapelsedawy665/payroll-system/database"
	"github.com/shehapelsedawy665/payroll-system/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AddDepartment إضافة قسم جديد وربطه بالشركة أوتوماتيكياً
func AddDepartment(c *fiber.Ctx) error {
	// 1. استخراج companyId من التوكن (عن طريق Middleware)
	companyIdStr, ok := c.Locals("companyId").(string)
	if !ok || companyIdStr == "" {
		return c.Status(401).JSON(fiber.Map{"error": "غير مصرح لك بالوصول، سجل الدخول أولاً"})
	}

	objID, err := primitive.ObjectIDFromHex(companyIdStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ID الشركة غير صالح"})
	}

	var dept models.Department
	if err := c.BodyParser(&dept); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "بيانات القسم غير صالحة"})
	}

	// 2. التحقق من البيانات الأساسية
	if dept.Name == "" || dept.Code == "" {
		return c.Status(400).JSON(fiber.Map{"error": "الاسم والكود مطلوبان"})
	}

	// ربط القسم بالشركة وتحديد وقت الإنشاء
	dept.CompanyID = objID
	dept.CreatedAt = time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := database.DB.Collection("departments")
	
	// حفظ القسم في MongoDB
	result, err := collection.InsertOne(ctx, dept)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "فشل في حفظ القسم في قاعدة البيانات"})
	}

	// تحديث الـ ID الخاص بالقسم بعد الحفظ بنجاح
	dept.ID = result.InsertedID.(primitive.ObjectID)

	return c.Status(201).JSON(fiber.Map{
		"message":    "تم إضافة القسم بنجاح ✅",
		"department": dept,
	})
}

// GetAllDepartments جلب كل أقسام الشركة الحالية فقط لضمان الخصوصية
func GetAllDepartments(c *fiber.Ctx) error {
	// استخراج companyId من التوكن
	companyIdStr, ok := c.Locals("companyId").(string)
	if !ok || companyIdStr == "" {
		return c.Status(401).JSON(fiber.Map{"error": "غير مصرح لك بالوصول"})
	}

	objID, err := primitive.ObjectIDFromHex(companyIdStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ID الشركة غير صالح"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := database.DB.Collection("departments")
	
	// الفلترة بناءً على الـ CompanyID لضمان أن كل شركة ترى أقسامها فقط
	filter := bson.M{"companyId": objID}
	
	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "خطأ أثناء جلب الأقسام من السيرفر"})
	}
	defer cursor.Close(ctx)

	var departments []models.Department
	if err = cursor.All(ctx, &departments); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "خطأ في معالجة بيانات الأقسام"})
	}

	// التأكد من إرجاع مصفوفة فارغة [] بدلاً من null في حالة عدم وجود بيانات
	if departments == nil {
		departments = []models.Department{}
	}

	return c.JSON(departments)
}
