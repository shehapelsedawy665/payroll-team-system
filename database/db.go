package database

import (
	"context"
	"log"
	"os"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoClient هو المتغير اللي هنستخدمه في كل مكان في السيستم
var (
	MongoClient *mongo.Client
	once        sync.Once // عشان نضمن إن الاتصال يحصل مرة واحدة بس (Singleton)
)

// ConnectDB وظيفة الاتصال بـ MongoDB Atlas
func ConnectDB() *mongo.Client {
	once.Do(func() {
		uri := os.Getenv("MONGODB_URI")
		if uri == "" {
			log.Fatal("❌ MONGODB_URI is missing in Environment Variables!")
		}

		// إعدادات الاتصال (Optimized for Vercel & Atlas)
		clientOptions := options.Client().
			ApplyURI(uri).
			SetMaxPoolSize(1). // زي ما عملت في Node بالظبط عشان الـ Serverless
			SetConnectTimeout(10 * time.Second).
			SetServerSelectionTimeout(5 * time.Second)

		// إنشاء سياق (Context) للاتصال بمهلة زمنية
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// الاتصال الفعلي
		client, err := mongo.Connect(ctx, clientOptions)
		if err != nil {
			log.Fatalf("❌ MongoDB Connection Error: %v", err)
		}

		// التأكد من أن السيرفر شغال (Ping)
		err = client.Ping(ctx, nil)
		if err != nil {
			log.Fatalf("❌ MongoDB Ping Error: %v", err)
		}

		log.Println("✅ MongoDB Connected | Ready for Go-Payroll Operations")
		MongoClient = client
	})

	return MongoClient
}

// GetCollection وظيفة مساعدة للوصول لأي جدول (Collection) بسهولة
func GetCollection(collectionName string) *mongo.Collection {
	return MongoClient.Database("payrollDB").Collection(collectionName)
}
