package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Department يمثل هيكل بيانات الأقسام داخل الشركة
type Department struct {
	ID          primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	Name        string              `bson:"name" json:"name"`
	Code        string              `bson:"code" json:"code"`
	
	// ربط القسم بشركة معينة (إجباري)
	CompanyID   primitive.ObjectID  `bson:"companyId" json:"companyId"`
	
	// Manager نستخدم Pointer هنا عشان يسمح بـ null لو القسم ملوش مدير حالياً
	// وده بيمنع الـ Error لو الحقل فاضي في MongoDB
	Manager     *primitive.ObjectID `bson:"manager,omitempty" json:"manager"` 
	
	Description string              `bson:"description" json:"description"`
	IsActive    bool                `bson:"isActive" json:"isActive"`
	CreatedAt   time.Time           `bson:"createdAt" json:"createdAt"`
}
