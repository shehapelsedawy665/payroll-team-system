package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Payroll يمثل سجل الراتب الشهري لموظف معين (Snapshot)
type Payroll struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	CompanyID  primitive.ObjectID `bson:"companyId" json:"companyId"`
	EmployeeID primitive.ObjectID `bson:"employeeId" json:"employeeId"`
	
	// تنسيق الشهر "2026-04" مهم جداً للفلترة والبحث
	Month      string             `bson:"month" json:"month"` 
	
	Payload    PayrollPayload     `bson:"payload" json:"payload"`
	Status     string             `bson:"status" json:"status"` // Pending, Approved, Paid
	CreatedAt  time.Time          `bson:"createdAt" json:"createdAt"`
}

// PayrollPayload تفاصيل الحسبة المالية النهائية وقت صدور المرتب
type PayrollPayload struct {
	GrossSalary       float64                `bson:"grossSalary" json:"grossSalary"`
	NetSalary         float64                `bson:"netSalary" json:"netSalary"`
	TaxAmount         float64                `bson:"taxAmount" json:"taxAmount"`
	InsuranceEmployee float64                `bson:"insuranceEmployee" json:"insuranceEmployee"`
	InsuranceCompany  float64                `bson:"insuranceCompany" json:"insuranceCompany"`
	TotalAdditions    float64                `bson:"totalAdditions" json:"totalAdditions"`
	TotalDeductions   float64                `bson:"totalDeductions" json:"totalDeductions"`
	
	// Details بنستخدمها لتخزين تفاصيل إضافية مرنة (مثل بنود البدلات المحددة)
	// ميزة omitempty هنا إنها مش هتخزن الحقل لو كان فاضي
	Details           map[string]interface{} `bson:"details,omitempty" json:"details,omitempty"`
}
