package api

import (
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	// التعديل الجوهري: ربط المسارات باسم الموديول الصحيح
	"github.com/shehapelsedawy665/payroll-team-system/database"
	"github.com/shehapelsedawy665/payroll-team-system/handlers"
	"github.com/shehapelsedawy665/payroll-team-system/middleware"
)

var app *fiber.App

// دالة init بتهيئ التطبيق مرة واحدة عند تشغيل الـ Function
func init() {
	// الاتصال بقاعدة البيانات
	database.ConnectDB()

	app = fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})

	// Middleware أساسية للمشروع
	app.Use(recover.New())
	app.Use(logger.New())
	
	// إعدادات الـ CORS لضمان قبول الطلبات من المتصفح
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowCredentials: true,
	}))

	// تعريف المسارات (Routes) تحت مظلة /api
	api := app.Group("/api")

	// مسارات المصادقة
	auth := api.Group("/auth")
	auth.Post("/register", handlers.RegisterCompany)
	auth.Post("/login", handlers.LoginCompany)

	// المسارات المحمية بـ JWT
	protected := api.Group("/", middleware.AuthRequired)

	// إدارة الموظفين
	employees := protected.Group("/employees")
	employees.Get("/", handlers.GetEmployees)
	employees.Post("/", handlers.CreateEmployee)
	employees.Get("/:id/details", handlers.GetEmployeeDetails)
	employees.Delete("/:id", handlers.DeleteEmployee)

	// الأقسام
	departments := protected.Group("/departments")
	departments.Get("/", handlers.GetAllDepartments)
	departments.Post("/add", handlers.AddDepartment)

	// عمليات الرواتب
	payroll := protected.Group("/payroll")
	payroll.Post("/calculate", handlers.CalculateAndSavePayroll)
	payroll.Post("/net-to-gross", handlers.NetToGrossCalculator)
}

// Handler هو المدخل الرئيسي لـ Vercel
func Handler(w http.ResponseWriter, r *http.Request) {
	// تحويل طلبات HTTP العادية لتعمل مع إطار عمل Fiber
	adaptor.FiberApp(app)(w, r)
}
