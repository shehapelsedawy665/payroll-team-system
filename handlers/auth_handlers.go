package handlers

import (
	"context"
	"os"
	"time"

	// التعديل هنا: استخدام المسار الصحيح للموديول بتاعك
	"github.com/shehapelsedawy665/payroll-team-system/database"
	"github.com/shehapelsedawy665/payroll-team-system/models"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v4"
	"go.mongodb.org/mongo-driver/bson"
	"golang.org/x/crypto/bcrypt"
)

// RegisterCompany تسجيل شركة جديدة بكلمة مرور مشفرة
func RegisterCompany(c *fiber.Ctx) error {
	var company models.Company
	if err := c.BodyParser(&company); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "بيانات غير صالحة"})
	}

	// 1. التحقق من اكتمال البيانات الأساسية
	if company.Name == "" || company.Email == "" || company.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "برجاء ملء جميع البيانات المطلوبة"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 2. التحقق من وجود الإيميل مسبقاً
	collection := database.DB.Collection("companies")
	count, _ := collection.CountDocuments(ctx, bson.M{"email": company.Email})
	if count > 0 {
		return c.Status(400).JSON(fiber.Map{"error": "هذا البريد الإلكتروني مسجل بالفعل"})
	}

	// 3. تشفير كلمة المرور (Bcrypt)
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(company.Password), 10)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "خطأ في تشفير البيانات"})
	}
	company.Password = string(hashedPassword)
	company.CreatedAt = time.Now()

	// 4. حفظ الشركة في MongoDB
	_, err = collection.InsertOne(ctx, company)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "فشل في تسجيل الشركة"})
	}

	return c.Status(201).JSON(fiber.Map{"message": "تم تسجيل الشركة بنجاح"})
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

	// البحث عن الشركة
	collection := database.DB.Collection("companies")
	var company models.Company
	err := collection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&company)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "بيانات الدخول غير صحيحة"})
	}

	// مقارنة الباسورد المبعوث مع المشفر (Bcrypt Compare)
	err = bcrypt.CompareHashAndPassword([]byte(company.Password), []byte(req.Password))
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "بيانات الدخول غير صحيحة"})
	}

	// إصدار JWT Token
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "seday_erp_secret_key_2026"
	}

	claims := jwt.MapClaims{
		"companyId": company.ID.Hex(),
		"email":     company.Email,
		"exp":       time.Now().Add(time.Hour * 24).Unix(), // صالح لمدة 24 ساعة
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
		"companyId":   company.ID.Hex(),
	})
}
