package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	// ملاحظة: تأكد من استبدال "golangtest" باسم المديول الحقيقي في ملف go.mod عندك
	"golangtest/database"
	"golangtest/handlers"
	"golangtest/middleware"
)

func main() {
	// 1. الاتصال بقاعدة البيانات (MongoDB Atlas) 
	// دي أهم خطوة، لو فشلت السيرفر هيوقف هنا ويقولك السبب في الـ Logs
	database.ConnectDB()

	// 2. إنشاء تطبيق Fiber بإعدادات الـ Production
	app := fiber.New(fiber.Config{
		DisableStartupMessage: false,
		AppName:               "Seday ERP Core v2 - Go Engine",
		// تحسين التعامل مع الـ JSON الكبيرة
		BodyLimit: 10 * 1024 * 1024, 
	})

	// 3. Middlewares الأساسية للاستقرار
	app.Use(recover.New()) // بيمنع السيرفر إنه يقع لو حصل خطأ في كود الـ Payroll
	app.Use(logger.New())  // بيطبع لك كل Request بيحصل في الـ Vercel Logs
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
	}))

	// 4. ربط الـ Routes (التقسيم المنطقي للـ API)
	api := app.Group("/api")

	// --- [A] مسارات الهوية (بدون حماية) ---
	auth := api.Group("/auth")
	auth.Post("/register", handlers.RegisterCompany)
	auth.Post("/login", handlers.LoginCompany)

	// --- [B] المسارات المحمية (تحتاج JWT Token) ---
	// الـ middleware.AuthRequired هو اللي بيتأكد إن المستخدم عامل login
	protected := api.Group("/", middleware.AuthRequired)

	// الموظفين (Employees)
	employees := protected.Group("/employees")
	employees.Get("/", handlers.GetEmployees)
	employees.Post("/", handlers.CreateEmployee)
	employees.Get("/:id/details", handlers.GetEmployeeDetails)
	employees.Delete("/:id", handlers.DeleteEmployee)

	// الأقسام (Departments)
	departments := protected.Group("/departments")
	departments.Get("/", handlers.GetAllDepartments)
	departments.Post("/add", handlers.AddDepartment)

	// محرك المرتبات (Payroll)
	payroll := protected.Group("/payroll")
	payroll.Post("/calculate", handlers.CalculateAndSavePayroll)
	payroll.Post("/net-to-gross", handlers.NetToGrossCalculator)

	// إعدادات الشركة (Settings)
	protected.Get("/company/settings", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"personalExemption": 20000,
			"maxInsSalary":      16700,
			"insEmployeePercent": 0.11,
		})
	})

	// 5. خدمة ملفات الـ Frontend (Public Folder)
	// تأكد إن فولدر public موجود في الـ Root بتاع المشروع
	app.Static("/", "./public")

	// 6. التعامل مع الـ 404 والـ Single Page Application (SPA) Routing
	app.Use(func(c *fiber.Ctx) error {
		// لو الطلب رايح لـ API مش موجود نرجع JSON
		if len(c.Path()) >= 4 && c.Path()[:4] == "/api" {
			return c.Status(404).JSON(fiber.Map{"error": "الرابط المطلوب غير موجود في الـ API"})
		}
		// لو أي مسار تاني نبعت الـ index.html عشان الـ JS يكمل الشغل
		return c.SendFile(filepath.Join("public", "index.html"))
	})

	// 7. تحديد المنفذ (Port) والتشغيل
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("🚀 Seday ERP Go Engine is LIVE on port %s", port)
	
	// تشغيل السيرفر
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("❌ Failed to start server: %v", err)
	}
}
