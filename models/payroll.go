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
	
	// تنسيق الشهر "YYYY-MM" (مثال: 2026-02) مهم جداً للتسلسل Sequential
	Month      string             `bson:"month" json:"month"` 
	
	Payload    PayrollPayload     `bson:"payload" json:"payload"`
	Status     string             `bson:"status" json:"status"` // Pending, Approved, Paid
	CreatedAt  time.Time          `bson:"createdAt" json:"createdAt"`
}

// PayrollAdjustment لحفظ تفاصيل كل إضافة أو خصم (ديناميكي للجدول والـ Popups)
type PayrollAdjustment struct {
	Name       string  `bson:"name" json:"name"`
	Amount     float64 `bson:"amount" json:"amount"`
	IsExempted bool    `bson:"isExempted" json:"isExempted"` // هل هي معفاة من الضرائب (زي الـ Medical)؟
}

// PayrollPayload تفاصيل الحسبة المالية الكاملة (النقطة رقم 10 و 11 و 12)
type PayrollPayload struct {
	// الرواتب الأساسية (Full vs Prorated)
	FullBasic          float64 `bson:"fullBasic" json:"fullBasic"`                   // الراتب الأساسي الكامل
	FullTransportation   float64 `bson:"fullTransportation" json:"fullTransportation"` // بدل الانتقال الكامل
	WorkingDays        int     `bson:"workingDays" json:"workingDays"`               // أيام العمل (بعد حساب التعيين/الاستقالة - نقطة 8)
	ProratedBasic      float64 `bson:"proratedBasic" json:"proratedBasic"`           // الأساسي النسبي حسب الأيام
	ProratedTransportation float64 `bson:"proratedTransportation" json:"proratedTransportation"` // الانتقالات النسبية
	
	// الإضافات والخصومات الديناميكية (نقطة 4 و 5)
	AdditionsList      []PayrollAdjustment `bson:"additionsList" json:"additionsList"`
	DeductionsList     []PayrollAdjustment `bson:"deductionsList" json:"deductionsList"`
	TotalAdditions     float64             `bson:"totalAdditions" json:"totalAdditions"`
	TotalDeductions    float64             `bson:"totalDeductions" json:"totalDeductions"`

	// الحسبة التأمينية (نقطة 1)
	InsuranceSalary    float64 `bson:"insuranceSalary" json:"insuranceSalary"`       // أجر الاشتراك التأميني
	InsuranceEmployee  float64 `bson:"insuranceEmployee" json:"insuranceEmployee"`   // حصة الموظف (11%)
	InsuranceCompany   float64 `bson:"insuranceCompany" json:"insuranceCompany"`     // حصة الشركة (18.75%)

	// الوعاء الضريبي والإعفاءات (نقطة 7)
	GrossSalary              float64 `bson:"grossSalary" json:"grossSalary"`                           // الإجمالي قبل الضرائب
	TaxableIncome            float64 `bson:"taxableIncome" json:"taxableIncome"`                       // الوعاء الضريبي المطبق
	PersonalExemptionApplied float64 `bson:"personalExemptionApplied" json:"personalExemptionApplied"` // الإعفاء الشخصي (شهرياً)
	MedicalExemptionApplied  float64 `bson:"medicalExemptionApplied" json:"medicalExemptionApplied"`   // إعفاء الطبي (نقطة 7)
	
	// الضرائب والرسوم القانونية (نقطة 10)
	TaxAmount          float64 `bson:"taxAmount" json:"taxAmount"`                   // ضريبة كسب العمل
	MartyrsFund        float64 `bson:"martyrsFund" json:"martyrsFund"`               // صندوق الشهداء (0.0005)
	
	// الصافي النهائي
	NetSalary          float64 `bson:"netSalary" json:"netSalary"`                   // الصافي النهائي
	
	// مرونة إضافية
	Details            map[string]interface{} `bson:"details,omitempty" json:"details,omitempty"`
}