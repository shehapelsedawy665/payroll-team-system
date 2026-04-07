package database

import (
	"context"
	"log"
	"os"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	MongoClient *mongo.Client
	DB          *mongo.Database
	once        sync.Once
)

// ConnectDB وظيفة الاتصال بـ MongoDB Atlas
func ConnectDB() {
	once.Do(func() {
		// 1. سحب الرابط من الـ Environment Variables حصراً
		// ممنوع كتابة الرابط هنا يدوياً عشان GitHub و GitGuardian
		uri := os.Getenv("MONGODB_URI")
		
		if uri == "" {
			log.Fatal("❌ MONGODB_URI missing! Please set it in Vercel Environment Variables.")
		}

		// 2. إعدادات الاتصال Optimized لبيئة الـ Serverless (Vercel)
		clientOptions := options.Client().
			ApplyURI(uri).
			SetMaxPoolSize(1).             // يمنع استهلاك الـ Connections المتاحة في الخطة المجانية
			SetConnectTimeout(10 * time.Second).
			SetServerSelectionTimeout(5 * time.Second)

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// 3. تنفيذ الاتصال الفعلي
		client, err := mongo.Connect(ctx, clientOptions)
		if err != nil {
			log.Fatalf("❌ MongoDB Connection Failed: %v", err)
		}

		// 4. اختبار الاتصال (Ping) للتأكد إن الباسوورد صح
		err = client.Ping(ctx, nil)
		if err != nil {
			log.Fatalf("❌ MongoDB Authentication Failed! Check your Password in Vercel: %v", err)
		}

		log.Println("✅ Seday ERP Go: Connected to Atlas successfully!")
		
		MongoClient = client
		DB = client.Database("payrollDB") // تأكد إن ده اسم القاعدة اللي فيها الداتا
	})
}

// GetCollection وظيفة مساعدة للوصول لأي جدول بسهولة من الـ Handlers
func GetCollection(collectionName string) *mongo.Collection {
	if DB == nil {
		ConnectDB()
	}
	return DB.Collection(collectionName)
}
