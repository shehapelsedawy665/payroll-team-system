package database

import (
	"context"
	"log"
	"os"
	"strings"
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
		// 1. سحب الرابط من الـ Environment Variables
		rawUri := os.Getenv("MONGODB_URI")
		uri := strings.TrimSpace(rawUri) // تنظيف الرابط من أي مسافات زيادة

		if uri == "" {
			log.Fatal("❌ Error: MONGODB_URI is missing in Vercel Environment Variables!")
		}

		// 2. إعدادات الاتصال المخصصة لبيئة الـ Serverless (Vercel)
		// SetMaxPoolSize(1) هو أهم سطر عشان يمنع تجاوز عدد الاتصالات المسموح به في Atlas
		clientOptions := options.Client().
			ApplyURI(uri).
			SetMaxPoolSize(1).
			SetMinPoolSize(0).
			SetConnectTimeout(10 * time.Second).
			SetServerSelectionTimeout(5 * time.Second).
			SetSocketTimeout(10 * time.Second)

		// 3. إنشاء سياق (Context) للاتصال بمهلة زمنية
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// 4. تنفيذ الاتصال الفعلي
		client, err := mongo.Connect(ctx, clientOptions)
		if err != nil {
			log.Fatalf("❌ MongoDB Connection Fatal Error: %v", err)
		}

		// 5. اختبار الاتصال (Ping) للتأكد أن الباسوورد والـ IP Access شغالين
		err = client.Ping(ctx, nil)
		if err != nil {
			log.Fatalf("❌ MongoDB Ping Failed: %v. Please Check: 1. User Password 2. Network Access (0.0.0.0/0)", err)
		}

		log.Println("✅ Seday ERP: MongoDB Connected Successfully!")
		
		MongoClient = client
		DB = client.Database("payrollDB") // تأكد أن هذا هو اسم الداتابيز الفعلي في Atlas
	})
}

// GetCollection وظيفة مساعدة للوصول للجداول بسهولة
func GetCollection(collectionName string) *mongo.Collection {
	if DB == nil {
		ConnectDB()
	}
	return DB.Collection(collectionName)
}
