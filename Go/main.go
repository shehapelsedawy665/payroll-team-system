package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"your-project/database"   // استبدل your-project باسم المديول بتاعك
	"your-project/handlers"   // الملفات اللي عملناها قبل كدة
	"your-project/middleware"
)

func main() {
	// 1. الاتصال بقاعدة البيانات (مرة واحدة عند التشغيل)
	database.ConnectDB()

	// 2. إنشاء تطبيق Fiber (بديل Express)
	app := fiber.New(fiber.Config{
		// إعدادات لتقليل استهلاك الـ Memory في الـ Serverless
		DisableStartupMessage: false,
		AppName:               "Seday ERP Core v2",
	})

	// 3. Middlewares الأساسية
	app.Use(logger.New())    // لمتابعة الـ Logs في السيرفر
	app.Use(recover.New())   // عشان لو حصل Crash السيرفر ما يوقعش
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*", // تقدر تحدد دومين الموبايل هنا للأمان
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	// 4. ربط الـ Routes
	api := app.Group("/api")

	// --- مسارات الموظفين (محمية بالـ JWT) ---
	employees := api.Group("/employees", middleware.AuthMiddleware)
	employees.Post("/", handlers.CreateEmployee)
	employees.Get("/", handlers.GetEmployees)
	employees.Get("/:id/details", handlers.GetEmployeeDetails)
	employees.Delete("/:id", handlers.DeleteEmployee)

	// --- إعدادات الشركة (محمية بالـ JWT) ---
	company := api.Group("/company", middleware.AuthMiddleware)
	
	// جلب الإعدادات
	company.Get("/settings", func(c *fiber.Ctx) error {
		// هنا تقدر تستخدم الـ Handler اللي بيجيب الداتا من Mongo
		// هكتبلك مثال سريع لجلب الـ Settings
		return c.JSON(fiber.Map{
			"personalExemption": 20000,
			"maxInsSalary":      16700,
			"insEmployeePercent": 0.11,
		})
	})

	// تحديث الإعدادات
	company.Post("/settings", func(c *fiber.Ctx) error {
		// تنفيذ منطق الـ Update باستخدام c.BodyParser
		return c.JSON(fiber.Map{"success": true, "message": "تم التحديث بنجاح"})
	})

	// 5. التعامل مع الملفات الثابتة (Public Folder)
	// ده بيخدم الـ index.html وأي ملفات CSS/JS عندك
	app.Static("/", "./public")

	// 6. التعامل مع أي مسار غير معروف (404 Fallback)
	app.Use(func(c *fiber.Ctx) error {
		// لو الرابط بيبدأ بـ /api نرجع JSON
		if len(c.Path()) >= 4 && c.Path()[:4] == "/api" {
			return c.Status(404).JSON(fiber.Map{"error": "الرابط المطلوب غير موجود في الـ API"})
		}
		// أي حاجة تانية تخدم ملف الـ index.html بتاع الـ Frontend
		return c.SendFile(filepath.Join("public", "index.html"))
	})

	// 7. التشغيل
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("Server LIVE on port %s 🚀", port)
	log.Fatal(app.Listen(":" + port))
}
