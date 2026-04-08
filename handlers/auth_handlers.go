package handlers

import (
	"context"
	"os"
	"time"

	"github.com/shehapelsedawy665/payroll-team-system/database"
	"github.com/shehapelsedawy665/payroll-team-system/models"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

// RegisterCompany تسجيل شركة جديدة مع دعم اختيار الـ Role
func RegisterCompany(c *fiber.Ctx) error {
	// تحديث الـ Input ليشمل الـ Role القادم من الـ HTML
	type RegisterInput struct {
		Name       string `json:"name"`
		Email      string `json:"email"`
		AdminEmail string `json:"adminEmail"`
		Password   string `json:"password"`
		Role       string `json:"role"` // الحقل ده ضروري لاستقبال اختيار المستخدم
	}

	var input RegisterInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "تنسيق البيانات غير صحيح"})
	}

	// 1. التحقق من اكتمال البيانات الأساسية
	if input.Name == "" || input.Email == "" || input.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "برجاء ملء جميع البيانات المطلوبة"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := database.DB.Collection("companies")

	// 2. التحقق من وجود الإيميل مسبقاً
	count, _ := collection.CountDocuments(ctx, bson.M{"email": input.Email})
	if count > 0 {
		return c.Status(400).JSON(fiber.Map{"error": "هذا البريد الإلكتروني مسجل بالفعل"})
	}

	// 3. تحديد الصلاحية (Role Logic)
	finalRole := input.Role
	if finalRole == "" {
		finalRole = "company" // القيمة الافتراضية
	}

	// لو المستخدم بيسجل كـ Company (User)، لازم نتحقق من بريد الأدمن
	if finalRole == "company" {
		if input.AdminEmail == "" {
			return c.Status(400).JSON(fiber.Map{"error": "برجاء إدخال بريد الأدمن المسؤول"})
		}
		var adminCheck models.Company
		err := collection.FindOne(ctx, bson.M{"email": input.AdminEmail, "role": "admin"}).Decode(&adminCheck)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "بريد الأدمن غير موجود أو ليس لديه صلاحية"})
		}
	}

	// 4. تشفير كلمة المرور
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), 10)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "خطأ في تشفير البيانات"})
	}

	// 5. تجهيز الموديل للحفظ مع الإعدادات الافتراضية
	newCompany := models.Company{
		ID:         primitive.NewObjectID(),
		Name:       input.Name,
		Email:      input.Email,
		Password:   string(hashedPassword),
		Role:       finalRole,
		AdminEmail: input.AdminEmail,
		Settings:   models.NewCompanySettings(), // تفعيل الإعدادات الافتراضية فوراً
		CreatedAt:  time.Now(),
	}

	// 6. حفظ في MongoDB
	_, err = collection.InsertOne(ctx, newCompany)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "فشل في حفظ بيانات الشركة"})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "تم التسجيل بنجاح كـ " + finalRole,
		"status":  "success",
	})
}

// LoginCompany تسجيل الدخول وإصدار JWT Token
func LoginCompany(c *fiber.Ctx) error {
	type LoginRequest struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "بيانات غير صالحة"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := database.DB.Collection("companies")
	var company models.Company
	err := collection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&company)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "بيانات الدخول غير صحيحة"})
	}

	err = bcrypt.CompareHashAndPassword([]byte(company.Password), []byte(req.Password))
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "بيانات الدخول غير صحيحة"})
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "seday_erp_secret_key_2026"
	}

	claims := jwt.MapClaims{
		"companyId": company.ID.Hex(),
		"email":     company.Email,
		"role":      company.Role,
		"exp":       time.Now().Add(time.Hour * 24).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, err := token.SignedString([]byte(secret))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "فشل في إنشاء التوكن"})
	}

	return c.JSON(fiber.Map{
		"success":     true,
		"token":       t,
		"companyName": company.Name,
		"role":        company.Role,
		"companyId":   company.ID.Hex(),
	})
}