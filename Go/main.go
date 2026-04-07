package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	// ملاحظة: تأكد أن "golangtest" هو الاسم المكتوب في أول سطر في ملف go.mod عندك
	"golangtest/database"
	"golangtest/handlers"
	"golangtest/middleware"
)

func main() {
	// 1. الاتصال بقاعدة البيانات (MongoDB Atlas) 
	// دي أهم خطوة، لو فشلت هنا السيرفر هيطبع السبب في الـ Vercel Logs ويقفل
	database.ConnectDB()

	// 2. إنشاء تطبيق Fiber بإعدادات متوافقة مع Vercel
	app := fiber.New(fiber.Config{
		DisableStartupMessage: false,
		AppName:               "Seday ERP Core v2 - Go Engine",
		BodyLimit:             10 * 1024 * 1024, // دعم ملفات لحد 10 ميجا
	})

	// 3. Middlewares الأساسية لضمان عدم توقف السيرفر
	app.Use(recover.New()) // الحماية من الـ Panic والـ Crash
	app.Use(logger.New())  // لمراقبة الطلبات في الـ Dashboard
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
	}))

	// 4. ربط المسارات (Routes)
	api := app.Group("/api")

	// --- [A] مسارات الهوية (بدون حماية) ---
	auth := api.Group("/auth")
	auth.Post("/register", handlers.RegisterCompany)
	auth.Post("/login", handlers.LoginCompany)

	// --- [B] المسارات المحمية (تحتاج JWT Token) ---
	protected := api.Group("/", middleware.AuthRequired)

	// إدارة الموظفين
	employees := protected.Group("/employees")
	employees.Get("/", handlers.GetEmployees)
	employees.Post("/", handlers.CreateEmployee)
	employees.Get("/:id/details", handlers.GetEmployeeDetails)
	employees.Delete("/:id", handlers.DeleteEmployee)

	// إدارة الأقسام
	departments := protected.Group("/departments")
	departments.Get("/", handlers.GetAllDepartments)
	departments.Post("/add", handlers.AddDepartment)

	// محرك المرتبات الضرائب (Egyptian Tax Logic)
	payroll := protected.Group("/payroll")
	payroll.Post("/calculate", handlers.CalculateAndSavePayroll)
	payroll.Post("/net-to-gross", handlers.NetToGrossCalculator)

	// إعدادات الشركة
	protected.Get("/company/settings", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"personalExemption": 20000,
			"maxInsSalary":      16700,
			"insEmployeePercent": 0.11,
		})
	})

	// 5. خدمة ملفات الـ Frontend (المهمة جداً لظهور الموقع)
	// تأكد أن فولدر public موجود في الـ Root بجانب main.go
	app.Static("/", "./public")

	// 6. التعامل مع الـ 404 والـ SPA Routing
	app.Use(func(c *fiber.Ctx) error {
		// لو الطلب لـ API غير موجود نرجع JSON 404
		if len(c.Path()) >= 4 && c.Path()[:4] == "/api" {
			return c.Status(404).JSON(fiber.Map{"error": "الرابط المطلوب غير موجود في نظام سداد"})
		}
		// لو أي مسار تاني نبعت الـ index.html عشان الـ Frontend يكمل (SPA)
		return c.SendFile(filepath.Join("public", "index.html"))
	})

	// 7. تحديد المنفذ (Port) والتشغيل
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("🚀 Seday ERP Go Engine is LIVE on port %s", port)
	
	// تشغيل السيرفر مع مراقبة الأخطاء
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("❌ Failed to start server: %v", err)
	}
}
