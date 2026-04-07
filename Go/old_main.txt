package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	// تأكد أن "golangtest" هو الموديول الصحيح في go.mod
	"golangtest/database"
	"golangtest/handlers"
	"golangtest/middleware"
)

func main() {
	// 1. الاتصال بقاعدة البيانات (MongoDB Atlas) 
	// السطر ده لو فشل، السيرفر هيطبع Error واضح جداً في Vercel Logs
	database.ConnectDB()

	// 2. إنشاء تطبيق Fiber
	app := fiber.New(fiber.Config{
		DisableStartupMessage: false,
		AppName:               "Seday ERP Core v2 - Go Engine",
		BodyLimit:             10 * 1024 * 1024, 
	})

	// 3. Middlewares الأساسية
	app.Use(recover.New()) // يمنع السيرفر من الانهيار (Crash)
	app.Use(logger.New())  // مراقبة الطلبات لحظياً
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

	// --- [B] المسارات المحمية (JWT Required) ---
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

	// محرك المرتبات (الضرائب والتأمينات المصرية)
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

	// 5. خدمة ملفات الـ Frontend (Public Folder)
	// استخدمنا Absolute Path لضمان عملها في Vercel
	workDir, _ := os.Getwd()
	app.Static("/", filepath.Join(workDir, "public"))

	// 6. التعامل مع الـ 404 والـ SPA Routing
	app.Use(func(c *fiber.Ctx) error {
		// لو API مش موجود
		if len(c.Path()) >= 4 && c.Path()[:4] == "/api" {
			return c.Status(404).JSON(fiber.Map{"error": "الرابط المطلوب غير موجود في نظام سداد"})
		}
		// تحويل أي مسار آخر لـ index.html لدعم React/Vue/Svelte
		return c.SendFile(filepath.Join(workDir, "public", "index.html"))
	})

	// 7. تحديد المنفذ والتشغيل
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("🚀 Seday ERP Go Engine is LIVE on port %s", port)
	
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("❌ Failed to start server: %v", err)
	}
}
