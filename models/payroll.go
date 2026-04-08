package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Payroll يمثل سجل الراتب الشهري لموظف معين (Snapshot)
type Payroll struct {
	// التعديل: خليناه _id في الـ json عشان الـ Frontend يعرف يقرأ الـ ID من MongoDB
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"_id"`
	CompanyID  primitive.ObjectID `bson:"companyId" json:"companyId"`
	EmployeeID primitive.ObjectID `bson:"employeeId" json:"employeeId"`
	
	// تنسيق الشهر "YYYY-MM" (مثال: 2026-02) مهم جداً للتسلسل Sequential
	Month      string             `bson:"month" json:"month"` 
	
	Payload    PayrollPayload     `bson:"payload" json:"payload"`
	Status     string             `bson:"status" json:"status"` // Pending, Approved, Paid
	CreatedAt  time.Time          `bson:"createdAt" json:"createdAt"`
}

// PayrollAdjustment لحفظ تفاصيل كل إضافة أو خصم
type PayrollAdjustment struct {
	Name       string  `bson:"name" json:"name"`
	Amount     float64 `bson:"amount" json:"amount"`
	IsExempted bool    `bson:"isExempted" json:"isExempted"` 
}

// PayrollPayload تفاصيل الحسبة المالية الكاملة
type PayrollPayload struct {
	FullBasic              float64 `bson:"fullBasic" json:"fullBasic"`
	FullTransportation     float64 `bson:"fullTransportation" json:"fullTransportation"`
	WorkingDays            int     `bson:"workingDays" json:"workingDays"`
	ProratedBasic          float64 `bson:"proratedBasic" json:"proratedBasic"`
	ProratedTransportation float64 `bson:"proratedTransportation" json:"proratedTransportation"`
	
	AdditionsList       []PayrollAdjustment `bson:"additionsList" json:"additionsList"`
	DeductionsList      []PayrollAdjustment `bson:"deductionsList" json:"deductionsList"`
	TotalAdditions      float64             `bson:"totalAdditions" json:"totalAdditions"`
	TotalDeductions     float64             `bson:"totalDeductions" json:"totalDeductions"`

	InsuranceSalary     float64 `bson:"insuranceSalary" json:"insuranceSalary"`
	InsuranceEmployee   float64 `bson:"insuranceEmployee" json:"insuranceEmployee"`
	InsuranceCompany    float64 `bson:"insuranceCompany" json:"insuranceCompany"`

	GrossSalary              float64 `bson:"grossSalary" json:"grossSalary"`
	TaxableIncome            float64 `bson:"taxableIncome" json:"taxableIncome"`
	PersonalExemptionApplied float64 `bson:"personalExemptionApplied" json:"personalExemptionApplied"`
	MedicalExemptionApplied  float64 `bson:"medicalExemptionApplied" json:"medicalExemptionApplied"`
	
	TaxAmount           float64 `bson:"taxAmount" json:"taxAmount"`
	MartyrsFund         float64 `bson:"martyrsFund" json:"martyrsFund"`
	
	NetSalary           float64 `bson:"netSalary" json:"netSalary"`
	
	Details             map[string]interface{} `bson:"details,omitempty" json:"details,omitempty"`
}