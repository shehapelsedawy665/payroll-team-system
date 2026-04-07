package middleware

import (
	"fmt"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// AuthRequired هو المفتش اللي بيتحقق من الـ Token (Middleware)
func AuthRequired(c *fiber.Ctx) error {
	// 1. الحصول على الـ Header (Authorization)
	authHeader := c.Get("Authorization")

	// التحقق من وجود الهيدر
	if authHeader == "" {
		return c.Status(401).JSON(fiber.Map{
			"success": false,
			"message": "غير مسموح بالدخول: الـ Token غير موجود",
		})
	}

	// 2. استخراج التوكن الفعلي من صيغة Bearer <token>
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return c.Status(401).JSON(fiber.Map{
			"success": false,
			"message": "تنسيق الـ Token غير صحيح (Bearer Token المطلوب)",
		})
	}
	tokenString := parts[1]

	// 3. الحصول على السر (Secret Key)
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "seday_erp_secret_key_2026" 
	}

	// 4. Parse الـ Token وفك التشفير باستخدام خوارزمية HMAC
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	// 5. معالجة أخطاء الصلاحية (Expired أو Invalid)
	if err != nil || !token.Valid {
		message := "الـ Token غير صالح أو تالف"
		if err != nil && strings.Contains(strings.ToLower(err.Error()), "expired") {
			message = "انتهت صلاحية الجلسة، برجاء تسجيل الدخول مرة أخرى"
		}
		return c.Status(401).JSON(fiber.Map{
			"success": false,
			"message": message,
		})
	}

	// 6. استخراج البيانات (Claims) وحفظها في الـ Context (Locals)
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		
		// أ. استخراج الـ Company ID (أساسي لكل العمليات)
		companyID, okID := claims["companyId"].(string)
		if !okID || companyID == "" {
			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"message": "الـ Token لا يحتوي على معرف الشركة",
			})
		}

		// ب. استخراج الـ Role (عشان نفرق بين الأدمن والشركة العادية)
		role, _ := claims["role"].(string)
		if role == "" {
			role = "company" // قيمة افتراضية للأمان
		}

		// حفظ البيانات في الـ Locals عشان الـ Handlers يوصلولها فوراً بـ c.Locals("key")
		c.Locals("companyId", companyID)
		c.Locals("role", role)
		c.Locals("email", claims["email"])
		
		return c.Next() // مبروك، اعدي للـ Handler اللي بعده
	}

	return c.Status(401).JSON(fiber.Map{
		"success": false, 
		"message": "فشل التحقق من بيانات الهوية داخل التوكن",
	})
}