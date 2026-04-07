package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	// ملاحظة: استبدل "your-project" بالاسم الموجود في أول سطر في ملف go.mod عندك
	"your-project/database"
	"your-project/handlers"
	"your-project/middleware"
)

func main() {
	// 1. الاتصال بقاعدة البيانات (MongoDB Atlas)
	database.ConnectDB()

	// 2. إنشاء تطبيق Fiber بأداء عالي
	app := fiber.New(fiber.Config{
		DisableStartupMessage: false,
		AppName:               "Seday ERP Core v2 - Go Engine",
	})

	// 3. Middlewares الأساسية للاستقرار والأمان
	app.Use(logger.New())  // لمراقبة الطلبات (Requests)
	app.Use(recover.New()) // الحماية من الـ Crash المفاجئ
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	// 4. ربط الـ Routes (التقسيم المنطقي)
	api := app.Group("/api")

	// --- [A] مسارات الهوية (بدون حماية - للـ Login والـ Register) ---
	auth := api.Group("/auth")
	auth.Post("/register", handlers.RegisterCompany)
	auth.Post("/login", handlers.LoginCompany)

	// --- [B] المسارات المحمية (تحتاج Token) ---
	// بنستخدم هنا الميدل وير اللي عملناه عشان نحمي البيانات
	protected := api.Group("/", middleware.AuthRequired)

	// 1. الموظفين (Employees)
	protected.Get("/employees", handlers.GetEmployees)
	protected.Post("/employees", handlers.CreateEmployee) // أو handlers.AddEmployee حسب ملفك
	protected.Get("/employees/:id/details", handlers.GetEmployeeDetails)
	protected.Delete("/employees/:id", handlers.DeleteEmployee)

	// 2. الأقسام (Departments)
	protected.Get("/departments", handlers.GetAllDepartments)
	protected.Post("/departments/add", handlers.AddDepartment)

	// 3. محرك المرتبات (Payroll)
	protected.Post("/payroll/calculate", handlers.CalculateAndSavePayroll)
	protected.Post("/payroll/net-to-gross", handlers.NetToGrossCalculator)

	// 4. إعدادات الشركة (Settings)
	company := protected.Group("/company")
	company.Get("/settings", func(c *fiber.Ctx) error {
		// مثال لاسترجاع الإعدادات (يفضل نقلها لـ Handler لاحقاً)
		return c.JSON(fiber.Map{
			"personalExemption": 20000,
			"maxInsSalary":      16700,
			"insEmployeePercent": 0.11,
		})
	})
	company.Post("/settings", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"success": true, "message": "تم تحديث الإعدادات بنجاح ✅"})
	})

	// 5. خدمة ملفات الـ Frontend (Public Folder)
	// لخدمة ملف الـ index.html والـ CSS/JS
	app.Static("/", "./public")

	// 6. التعامل مع الـ 404 والـ SPA Routing
	app.Use(func(c *fiber.Ctx) error {
		// لو الطلب للـ API مش موجود نرجع 404 JSON
		if len(c.Path()) >= 4 && c.Path()[:4] == "/api" {
			return c.Status(404).JSON(fiber.Map{"error": "الرابط المطلوب غير موجود في نظام السداد"})
		}
		// لو أي مسار تاني (زي البروفايل أو الموظفين في الـ URL) نرجع الـ index.html
		return c.SendFile(filepath.Join("public", "index.html"))
	})

	// 7. تحديد المنفذ (Port) والتشغيل
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("🚀 Seday ERP Go Engine is LIVE on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
