package api // ركز إن اسم الباكدج هنا api

import (
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	// تأكد إن golangtest هو نفس اسم مشروعك في go.mod
	"golangtest/database"
	"golangtest/handlers"
	"golangtest/middleware"
)

var app *fiber.App

// دالة init بتشتغل مرة واحدة وتجهز السيرفر من غير ما تعلقه
func init() {
	database.ConnectDB()

	app = fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
	}))

	api := app.Group("/api")

	auth := api.Group("/auth")
	auth.Post("/register", handlers.RegisterCompany)
	auth.Post("/login", handlers.LoginCompany)

	protected := api.Group("/", middleware.AuthRequired)

	employees := protected.Group("/employees")
	employees.Get("/", handlers.GetEmployees)
	employees.Post("/", handlers.CreateEmployee)
	employees.Get("/:id/details", handlers.GetEmployeeDetails)
	employees.Delete("/:id", handlers.DeleteEmployee)

	departments := protected.Group("/departments")
	departments.Get("/", handlers.GetAllDepartments)
	departments.Post("/add", handlers.AddDepartment)

	payroll := protected.Group("/payroll")
	payroll.Post("/calculate", handlers.CalculateAndSavePayroll)
	payroll.Post("/net-to-gross", handlers.NetToGrossCalculator)
}

// Handler - دي "الكلمة السحرية" اللي Vercel بيدور عليها عشان يشغل الكود
func Handler(w http.ResponseWriter, r *http.Request) {
	adaptor.FiberApp(app)(w, r)
}
