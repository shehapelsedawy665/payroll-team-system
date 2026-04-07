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

func ConnectDB() {
	once.Do(func() {
		// بيسحب الرابط من Vercel Environment Variables فقط
		uri := os.Getenv("MONGODB_URI")
		if uri == "" {
			log.Fatal("❌ MONGODB_URI is not set in Vercel!")
		}

		clientOptions := options.Client().
			ApplyURI(uri).
			SetMaxPoolSize(1). // مهم جداً لبيئة الـ Serverless
			SetConnectTimeout(10 * time.Second)

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		client, err := mongo.Connect(ctx, clientOptions)
		if err != nil {
			log.Fatalf("❌ Connection Failed: %v", err)
		}

		// اختبار الاتصال الفعلي
		err = client.Ping(ctx, nil)
		if err != nil {
			log.Fatalf("❌ Ping Failed (Check Password & IP Access): %v", err)
		}

		log.Println("✅ Connected to MongoDB Atlas!")
		MongoClient = client
		DB = client.Database("payrollDB")
	})
}

func GetCollection(name string) *mongo.Collection {
	if DB == nil {
		ConnectDB()
	}
	return DB.Collection(name)
}
