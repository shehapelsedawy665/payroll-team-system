package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Employee يمثل هيكل بيانات الموظف في النظام
type Employee struct {
	ID               primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name             string             `bson:"name" json:"name"`
	NationalID       string             `bson:"nationalId" json:"nationalId"`
	Email            string             `bson:"email" json:"email"`
	Phone            string             `bson:"phone" json:"phone"`
	CompanyID        primitive.ObjectID `bson:"companyId" json:"companyId"`
	Department       string             `bson:"department" json:"department"`
	JobTitle         string             `bson:"jobTitle" json:"jobTitle"`
	ReportingTo      *primitive.ObjectID `bson:"reportingTo" json:"reportingTo"` // استخدمنا Pointer عشان يقبل null
	HireDate         time.Time          `bson:"hireDate" json:"hireDate"`
	ResignationDate  *time.Time         `bson:"resignationDate" json:"resignationDate"`
	EmploymentType   string             `bson:"employmentType" json:"employmentType"` // Full-time, Part-time, Contractor
	SalaryDetails    SalaryDetails      `bson:"salaryDetails" json:"salaryDetails"`
	History          []HistoryRecord    `bson:"history" json:"history"`
	Documents        []Document         `bson:"documents" json:"documents"`
	Status           string             `bson:"status" json:"status"` // Active, Inactive, Resigned
	CreatedAt        time.Time          `bson:"createdAt" json:"createdAt"`
}

// SalaryDetails تفاصيل الراتب والبدلات والخصومات
type SalaryDetails struct {
	BasicSalary float64     `bson:"basicSalary" json:"basicSalary"`
	Additions   []Component `bson:"additions" json:"additions"`
	Deductions  []Component `bson:"deductions" json:"deductions"`
}

// Component يمثل بند مالي (بدل أو خصم)
type Component struct {
	Name      string  `bson:"name" json:"name"`
	Amount    float64 `bson:"amount" json:"amount"`
	Type      string  `bson:"type" json:"type"` // Exempted, Non-Exempted
	IsMedical bool    `bson:"isMedical,omitempty" json:"isMedical,omitempty"`
}

// HistoryRecord سجل المرتبات الشهري
type HistoryRecord struct {
	Month   string      `bson:"month" json:"month"`
	Payload interface{} `bson:"payload" json:"payload"` // interface{} تعني أي نوع بيانات (زي Object في JS)
}

// Document الوثائق المرفقة للموظف
type Document struct {
	Title      string     `bson:"title" json:"title"`
	FileURL    string     `bson:"fileUrl" json:"fileUrl"`
	ExpiryDate *time.Time `bson:"expiryDate" json:"expiryDate"`
}
