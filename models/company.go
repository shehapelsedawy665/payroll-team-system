package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// الثوابت العالمية لنظام السداد 2026 (قوانين الضرائب المصرية)
// دي القيم الافتراضية اللي السيستم بيفتح عليها لأي شركة جديدة
const (
	InsEmployeePercent    = 0.11    // 11% حصة الموظف في التأمينات
	InsCompanyPercent     = 0.1875  // 18.75% حصة الشركة في التأمينات
	MaxInsSalary          = 16700.0 // الحد الأقصى للتأمينات 2026
	MinInsSalary          = 2325.0  // الحد الأدنى للتأمينات
	PersonalExemption     = 20000.0 // الإعفاء الشخصي السنوي للموظف
	MedicalExemptionLimit = 10000.0 // حد الإعفاء الطبي السنوي
	DefaultWorkingDays    = 30      // عدد أيام الشهر الافتراضية للحساب
)

// Company يمثل هيكل بيانات الشركة في النظام
type Company struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name               string             `bson:"name" json:"name"`
	AdminEmail         string             `bson:"adminEmail" json:"adminEmail"`
	Email              string             `bson:"email" json:"email"`
	Password           string             `bson:"password" json:"-"`
	Role               string             `bson:"role" json:"role"` // "admin" أو "company"
	Settings           CompanySettings    `bson:"settings" json:"settings"`
	CreatedAt          time.Time          `bson:"createdAt" json:"createdAt"`
	LastSettingsUpdate time.Time          `bson:"lastSettingsUpdate" json:"lastSettingsUpdate"`
}

// CompanySettings الإعدادات القابلة للتخصيص لكل شركة (نقطة رقم 4)
type CompanySettings struct {
	InsEmployeePercent    float64 `bson:"insEmployeePercent" json:"insEmployeePercent"`
	MaxInsSalary          float64 `bson:"maxInsSalary" json:"maxInsSalary"`
	PersonalExemption     float64 `bson:"personalExemption" json:"personalExemption"`
	MedicalExemptionLimit float64 `bson:"medicalExemptionLimit" json:"medicalExemptionLimit"`
	
	// حقول جديدة لزيادة المرونة بين الشركات
	WorkingDays           int     `bson:"workingDays" json:"workingDays"`           // أيام العمل (30 أو 26 أو 22)
	Currency              string  `bson:"currency" json:"currency"`                 // EGP, USD, etc.
	CompanyLogo           string  `bson:"companyLogo" json:"companyLogo"`
	IsActive              bool    `bson:"isActive" json:"isActive"`
}

// NewCompanySettings دالة لإنشاء إعدادات افتراضية عند تسجيل شركة جديدة
func NewCompanySettings() CompanySettings {
	return CompanySettings{
		InsEmployeePercent:    InsEmployeePercent,
		MaxInsSalary:          MaxInsSalary,
		PersonalExemption:     PersonalExemption,
		MedicalExemptionLimit: MedicalExemptionLimit,
		WorkingDays:           DefaultWorkingDays,
		Currency:              "EGP",
		IsActive:              true,
	}
}