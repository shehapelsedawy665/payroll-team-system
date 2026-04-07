package middleware

import (
	"fmt"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// AuthRequired هو المفتش اللي بيتحقق من الـ Token (Middleware)
// تم تغيير الاسم ليتوافق مع المنادى عليه في api/index.go
func AuthRequired(c *fiber.Ctx) error {
	// 1. الحصول على الـ Header (Authorization)
	authHeader := c.Get("Authorization")

	// التحقق من وجود كلمة Bearer وتنسيق الهيدر
	if authHeader == "" {
		return c.Status(401).JSON(fiber.Map{
			"success": false,
			"message": "غير مسموح بالدخول: الـ Token غير موجود",
		})
	}

	// استخراج التوكن الفعلي (تجنب الـ Index Out of Range لو الهيدر غريب)
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return c.Status(401).JSON(fiber.Map{
			"success": false,
			"message": "تنسيق الـ Token غير صحيح (Bearer Token المطلوب)",
		})
	}
	tokenString := parts[1]

	// 3. التحقق من التوكن (Verification)
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// القيمة الافتراضية - تأكد من مطابقتها لما في الـ Login Handler
		secret = "seday_erp_secret_key_2026" 
	}

	// Parse الـ Token وفك التشفير
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// التأكد من أن خوارزمية التشفير هي HMAC
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	// 4. معالجة الأخطاء (Expired أو Invalid)
	if err != nil || !token.Valid {
		message := "الـ Token غير صالح أو تالف"
		if err != nil && strings.Contains(err.Error(), "expired") {
			message = "انتهت صلاحية الجلسة، برجاء تسجيل الدخول مرة أخرى"
		}
		return c.Status(401).JSON(fiber.Map{
			"success": false,
			"message": message,
		})
	}

	// 5. استخراج البيانات (Claims) ووضعها في الـ Context (Locals)
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		// استخراج companyId
		companyID, ok := claims["companyId"].(string)
		if !ok || companyID == "" {
			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"message": "الـ Token لا يحتوي على بيانات الشركة التعريفية",
			})
		}

		// حفظ الـ companyId في الـ Locals عشان الـ Handlers يوصلوله بسهولة
		// ده بديل لـ req.user في Node.js
		c.Locals("companyId", companyID)
		
		return c.Next() // اسمح بالمرور للمسار التالي (الـ Handler)
	}

	return c.Status(401).JSON(fiber.Map{"success": false, "message": "فشل التحقق من الهوية"})
}
