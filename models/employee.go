package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Employee يمثل هيكل بيانات الموظف في النظام
type Employee struct {
	ID              primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	Name            string              `bson:"name" json:"name"`
	NationalID      string              `bson:"nationalId" json:"nationalId"`
	Email           string              `bson:"email" json:"email"`
	Phone           string              `bson:"phone" json:"phone"`
	CompanyID       primitive.ObjectID  `bson:"companyId" json:"companyId"`
	Department      string              `bson:"department" json:"department"`
	JobTitle        string              `bson:"jobTitle" json:"jobTitle"`
	
	// يسمح بوجود موظفين معندهمش مدير
	ReportingTo     *primitive.ObjectID `bson:"reportingTo,omitempty" json:"reportingTo"` 
	
	HireDate        time.Time           `bson:"hireDate" json:"hireDate"`
	ResignationDate *time.Time          `bson:"resignationDate,omitempty" json:"resignationDate"`
	
	EmploymentType  string              `bson:"employmentType" json:"employmentType"` // Full-time, Part-time
	SalaryDetails   SalaryDetails       `bson:"salaryDetails" json:"salaryDetails"`
	
	History         []HistoryRecord     `bson:"history,omitempty" json:"history"`
	Documents       []Document          `bson:"documents,omitempty" json:"documents"`
	
	Status          string              `bson:"status" json:"status"` // Active, Inactive, Resigned
	CreatedAt       time.Time           `bson:"createdAt" json:"createdAt"`
}

// SalaryDetails تفاصيل الراتب والبدلات والخصومات
type SalaryDetails struct {
	BasicSalary float64     `bson:"basicSalary" json:"basicSalary"`
	// NetToGrossTarget يستخدم لو الشركة عايزة تدخل الصافي والسيستم يحسب الـ Gross
	NetToGrossTarget float64 `bson:"netToGrossTarget,omitempty" json:"netToGrossTarget"` 
	Additions   []Component `bson:"additions,omitempty" json:"additions"`
	Deductions  []Component `bson:"deductions,omitempty" json:"deductions"`
}

// Component يمثل بند مالي (بدل أو خصم)
type Component struct {
	Name       string  `bson:"name" json:"name"`
	Amount     float64 `bson:"amount" json:"amount"`
	// Type: "Exempted" (معفي من الضرائب) أو "Non-Exempted" (خاضع للضرائب)
	Type       string  `bson:"type" json:"type"` 
	// IsMedical: لو true، السيستم هيطبق معادلة الـ (أيهما أقل) اللي طلبتها
	IsMedical  bool    `bson:"isMedical,omitempty" json:"isMedical"`
}

// HistoryRecord سجل المرتبات الشهري
type HistoryRecord struct {
	Month   string      `bson:"month" json:"month"`
	Payload interface{} `bson:"payload" json:"payload"` 
}

// Document الوثائق المرفقة للموظف
type Document struct {
	Title      string     `bson:"title" json:"title"`
	FileURL    string     `bson:"fileUrl" json:"fileUrl"`
	ExpiryDate *time.Time `bson:"expiryDate,omitempty" json:"expiryDate"`
}