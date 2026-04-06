package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// الثوابت العالمية لنظام السداد 2026 (قوانين الضرائب المصرية)
const (
	InsEmployeePercent     = 0.11    // 11%
	InsCompanyPercent      = 0.1875  // 18.75%
	MaxInsSalary           = 16700.0 // الحد الأقصى للتأمينات
	MinInsSalary           = 2325.0  // الحد الأدنى للتأمينات
	PersonalExemption      = 20000.0 // الإعفاء الشخصي السنوي
	MedicalExemptionLimit  = 10000.0 // حد الإعفاء الطبي السنوي
)

// Company يمثل هيكل بيانات الشركة في النظام
type Company struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name               string             `bson:"name" json:"name"`
	AdminEmail         string             `bson:"adminEmail" json:"adminEmail"`
	Email              string             `bson:"email" json:"email"`
	Password           string             `bson:"password" json:"-"` // العلامة "-" بتخفي الباسورد من الـ JSON للخصوصية
	Settings           CompanySettings    `bson:"settings" json:"settings"`
	CreatedAt          time.Time          `bson:"createdAt" json:"createdAt"`
	LastSettingsUpdate time.Time          `bson:"lastSettingsUpdate" json:"lastSettingsUpdate"`
}

// CompanySettings الإعدادات القابلة للتخصيص لكل شركة
type CompanySettings struct {
	InsEmployeePercent    float64 `bson:"insEmployeePercent" json:"insEmployeePercent"`
	MaxInsSalary          float64 `bson:"maxInsSalary" json:"maxInsSalary"`
	PersonalExemption     float64 `bson:"personalExemption" json:"personalExemption"`
	MedicalExemptionLimit float64 `bson:"medicalExemptionLimit" json:"medicalExemptionLimit"`
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
		IsActive:              true,
	}
}
