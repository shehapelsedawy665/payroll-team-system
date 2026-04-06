package middleware

import (
	"fmt"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// AuthMiddleware هو المفتش اللي بيتحقق من الـ Token قبل دخول أي Route
func AuthMiddleware(c *fiber.Ctx) error {
	// 1. الحصول على الـ Header
	authHeader := c.Get("Authorization")

	// التحقق من وجود كلمة Bearer وتنسيق الهيدر
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return c.Status(401).JSON(fiber.Map{
			"success": false,
			"message": "غير مسموح بالدخول: الـ Token غير موجود أو بتنسيق خاطئ",
		})
	}

	// 2. استخراج التوكن الفعلي
	tokenString := strings.Split(authHeader, " ")[1]

	// 3. التحقق من التوكن (Verification)
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "seday_erp_secret_key_2026" // القيمة الافتراضية للتجربة فقط
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// التأكد من أن خوارزمية التشفير هي HMAC (نفس اللي استخدمتها في Node)
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	// 4. معالجة الأخطاء (Expired أو Invalid)
	if err != nil || !token.Valid {
		message := "الـ Token غير صالح أو تالف"
		if strings.Contains(err.Error(), "expired") {
			message = "انتهت صلاحية الجلسة، برجاء تسجيل الدخول مرة أخرى"
		}
		return c.Status(401).JSON(fiber.Map{
			"success": false,
			"message": message,
		})
	}

	// 5. استخراج البيانات (Claims) ووضعها في الـ Context
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		companyID, ok := claims["companyId"].(string)
		if !ok || companyID == "" {
			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"message": "الـ Token صالح ولكن لا يحتوي على بيانات الشركة",
			})
		}

		// حفظ الـ companyId عشان الـ Routes اللي جاية تستخدمه (بدل req.user)
		c.Locals("companyId", companyID)
		
		return c.Next() // اسمح بالمرور للمسار التالي
	}

	return c.Status(401).JSON(fiber.Map{"success": false, "message": "فشل التحقق من الهوية"})
}
