package api

import (
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	// الربط بالموديول الخاص بك
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
	
	// إعدادات الـ CORS المعدلة لضمان عدم حدوث Block من المتصفح
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Requested-With",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowCredentials: true,
	}))

	// تعريف المسارات (Routes) تحت مظلة /api
	api := app.Group("/api")

	// 1. مسارات المصادقة (مفتوحة للجميع)
	auth := api.Group("/auth")
	auth.Post("/register", handlers.RegisterCompany)
	auth.Post("/login", handlers.LoginCompany)

	// 2. المسارات المحمية بـ JWT (تحتاج Token صالح)
	// تأكد أن middleware.AuthRequired يقرأ الـ Role والـ CompanyId ويخزنهم في الـ Context
	protected := api.Group("/", middleware.AuthRequired)

	// إدارة الموظفين - مربوطة بـ CompanyId الخاص بالتوكن
	employees := protected.Group("/employees")
	employees.Get("/", handlers.GetEmployees)            // جلب موظفي الشركة فقط
	employees.Post("/", handlers.CreateEmployee)        // إضافة موظف للشركة
	employees.Get("/:id/details", handlers.GetEmployeeDetails)
	employees.Delete("/:id", handlers.DeleteEmployee)

	// الأقسام
	departments := protected.Group("/departments")
	departments.Get("/", handlers.GetAllDepartments)
	departments.Post("/add", handlers.AddDepartment)

	// عمليات الرواتب - تعتمد على قوانين 2026 المخزنة في الموديل
	payroll := protected.Group("/payroll")
	payroll.Post("/calculate", handlers.CalculateAndSavePayroll)
	payroll.Post("/net-to-gross", handlers.NetToGrossCalculator)
}

// Handler هو المدخل الرئيسي لـ Vercel
func Handler(w http.ResponseWriter, r *http.Request) {
	// تحويل طلبات HTTP العادية لتعمل مع إطار عمل Fiber
	adaptor.FiberApp(app)(w, r)
}