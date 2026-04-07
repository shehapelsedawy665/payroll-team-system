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
		// 1. سحب الرابط من الـ Environment Variables
		uri := os.Getenv("MONGODB_URI")
		if uri == "" {
			// لو مش موجود، بنستخدم الرابط بتاعك كـ Fallback للتجربة فقط
			uri = "mongodb+srv://Sedawy:Shehap66Sedawy@egyptian-payroll.a6bquen.mongodb.net/payrollDB?retryWrites=true&w=majority"
		}

		// 2. إعدادات الاتصال Optimized لـ Vercel (Serverless)
		clientOptions := options.Client().
			ApplyURI(uri).
			SetMaxPoolSize(1).             // مهم جداً لعدم استهلاك الـ Connections في Vercel
			SetConnectTimeout(10 * time.Second).
			SetServerSelectionTimeout(5 * time.Second)

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// 3. تنفيذ الاتصال
		client, err := mongo.Connect(ctx, clientOptions)
		if err != nil {
			log.Fatalf("❌ MongoDB Connection Error: %v", err)
		}

		// 4. اختبار الاتصال (Ping)
		err = client.Ping(ctx, nil)
		if err != nil {
			log.Fatalf("❌ MongoDB Ping Error: %v", err)
		}

		log.Println("✅ Seday ERP: MongoDB Connected Successfully!")
		
		MongoClient = client
		DB = client.Database("payrollDB") // تحديد قاعدة البيانات الافتراضية للسيستم
	})
}

// GetCollection وظيفة مساعدة للوصول لأي جدول بسهولة
func GetCollection(collectionName string) *mongo.Collection {
	if DB == nil {
		ConnectDB()
	}
	return DB.Collection(collectionName)
}
