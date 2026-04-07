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
	
	// تنسيق الشهر "YYYY-MM" (مثال: 2026-01) مهم جداً للفلترة والتسلسل Sequential
	Month      string             `bson:"month" json:"month"` 
	
	Payload    PayrollPayload     `bson:"payload" json:"payload"`
	Status     string             `bson:"status" json:"status"` // Pending, Approved, Paid
	CreatedAt  time.Time          `bson:"createdAt" json:"createdAt"`
}

// PayrollAdjustment لحفظ تفاصيل كل إضافة أو خصم (عشان الجدول الديناميكي)
type PayrollAdjustment struct {
	Name       string  `bson:"name" json:"name"`
	Amount     float64 `bson:"amount" json:"amount"`
	IsExempted bool    `bson:"isExempted" json:"isExempted"` // هل هي معفاة من الضرائب أم لا؟
}

// PayrollPayload تفاصيل الحسبة المالية النهائية وقت صدور المرتب
type PayrollPayload struct {
	BasicSalary              float64                `bson:"basicSalary" json:"basicSalary"` // الراتب الأساسي
	GrossSalary              float64                `bson:"grossSalary" json:"grossSalary"` // الإجمالي بعد الإضافات
	NetSalary                float64                `bson:"netSalary" json:"netSalary"`     // الصافي النهائي
	TaxableIncome            float64                `bson:"taxableIncome" json:"taxableIncome"` // الوعاء الضريبي (مهم جداً للمراجعة)
	TaxAmount                float64                `bson:"taxAmount" json:"taxAmount"`     // قيمة الضرائب
	InsuranceEmployee        float64                `bson:"insuranceEmployee" json:"insuranceEmployee"` // تأمينات الموظف
	InsuranceCompany         float64                `bson:"insuranceCompany" json:"insuranceCompany"`   // حصة الشركة
	
	// حقول جديدة لخدمة الـ Logic المعقد اللي طلبته
	PersonalExemptionApplied float64                `bson:"personalExemptionApplied" json:"personalExemptionApplied"` // الإعفاء الشخصي المطبق
	MedicalExemptionApplied  float64                `bson:"medicalExemptionApplied" json:"medicalExemptionApplied"`   // الإعفاء الطبي (أيهما أقل)
	WorkingDays              int                    `bson:"workingDays" json:"workingDays"` // أيام العمل الفعلية (عشان التعيين والاستقالة)
	
	// الإجماليات والتفاصيل الديناميكية
	TotalAdditions           float64                `bson:"totalAdditions" json:"totalAdditions"`
	TotalDeductions          float64                `bson:"totalDeductions" json:"totalDeductions"`
	AdditionsList            []PayrollAdjustment    `bson:"additionsList" json:"additionsList"`   // تفاصيل البدلات (مثل: Meal allowance)
	DeductionsList           []PayrollAdjustment    `bson:"deductionsList" json:"deductionsList"` // تفاصيل الخصومات
	
	// Details بنستخدمها لتخزين تفاصيل إضافية مرنة
	Details                  map[string]interface{} `bson:"details,omitempty" json:"details,omitempty"`
}