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
	DB          *mongo.Database // المتغير اللي الـ Handlers بتستخدمه مباشرة
	once        sync.Once
)

// ConnectDB وظيفة الاتصال بـ MongoDB Atlas
func ConnectDB() {
	once.Do(func() {
		// 1. سحب الرابط من الـ Environment Variables حصراً
		uri := os.Getenv("MONGODB_URI")
		if uri == "" {
			log.Fatal("❌ MONGODB_URI is missing in Vercel Environment Variables!")
		}

		// 2. إعدادات الاتصال المخصصة لبيئة الـ Serverless
		// الـ MaxPoolSize(1) ده هو السر عشان Vercel ما يقفلش عليك الاتصال
		clientOptions := options.Client().
			ApplyURI(uri).
			SetMaxPoolSize(1).
			SetMinPoolSize(0).
			SetConnectTimeout(10 * time.Second).
			SetServerSelectionTimeout(5 * time.Second)

		// 3. إنشاء سياق (Context) للاتصال
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// 4. تنفيذ الاتصال
		client, err := mongo.Connect(ctx, clientOptions)
		if err != nil {
			log.Fatalf("❌ MongoDB Connection Error: %v", err)
		}

		// 5. اختبار الاتصال (Ping) - أهم خطوة للتأكد إن الباسوورد والـ IP تمام
		err = client.Ping(ctx, nil)
		if err != nil {
			log.Fatalf("❌ MongoDB Ping Failed: %v. Check IP Access (0.0.0.0/0) and Password!", err)
		}

		log.Println("✅ Seday ERP: MongoDB Connected Successfully!")
		
		MongoClient = client
		DB = client.Database("payrollDB") // تأكد إن ده اسم قاعدة البيانات في Atlas
	})
}

// GetCollection وظيفة مساعدة للوصول لأي جدول (Collection) بسهولة من الـ Handlers
func GetCollection(collectionName string) *mongo.Collection {
	if DB == nil {
		ConnectDB()
	}
	return DB.Collection(collectionName)
}
