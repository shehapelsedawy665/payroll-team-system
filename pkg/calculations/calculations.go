package calculations

import (
	"math"

	// استيراد الموديلز لضمان توافق الأنواع
	"github.com/shehapelsedawy665/payroll-team-system/models"
)

// R هي دالة لتقريب الأرقام لأقرب قرشين
func R(n float64) float64 {
	return math.Round(n*100) / 100
}

// CalculateEgyptianPayroll هو المحرك الأساسي الذي ينادي عليه الـ Handler
func CalculateEgyptianPayroll(emp models.Employee, settings models.CompanySettings, days int, additions float64, deductions float64) models.PayrollPayload {
	
	// تحويل البيانات من الـ Model للهيكل اللي المعادلات بتفهمه
	input := models.SalaryDetails{
		BasicSalary: emp.SalaryDetails.BasicSalary,
	}

	// 1. حساب التأمينات
	// نستخدم الحد الأقصى من الإعدادات (16700 لعام 2026)
	insEEPercent := 0.11
	if settings.InsEmployeePercent > 0 {
		insEEPercent = settings.InsEmployeePercent
	}
	
	maxLimit := 16700.0
	if settings.MaxInsSalary > 0 {
		maxLimit = settings.MaxInsSalary
	}

	// الراتب التأميني (بناءً على الأساسي بحد أدنى وأقصى)
	insSalary := math.Min(math.Max(input.BasicSalary, 2325), maxLimit)
	insuranceEmployee := R(insSalary * insEEPercent)
	insuranceCompany := R(insSalary * 0.1875) // حصة الشركة 18.75%

	// 2. حساب الأيام الفعلية (Proration)
	finalDays := float64(days)
	if finalDays > 30 {
		finalDays = 30
	}
	proratedBasic := R((input.BasicSalary / 30) * finalDays)

	// 3. إجمالي الاستحقاقات (Gross)
	// نجمع الراتب الفعلي + الإضافات الخارجية من الـ Request
	grossSalary := proratedBasic + additions

	// 4. الوعاء الضريبي (Taxable Income)
	// الخصومات الضريبية: التأمينات + الإعفاء الشخصي (20000 سنوياً / 12 شهر)
	personalExemptionMonthly := settings.PersonalExemption / 12
	if personalExemptionMonthly == 0 {
		personalExemptionMonthly = 20000.0 / 12.0
	}

	taxableIncome := math.Max(0, grossSalary - insuranceEmployee - personalExemptionMonthly)

	// 5. حساب الضريبة الشهرية بناءً على الشرائح
	annualTaxable := math.Floor((taxableIncome * 12)/10) * 10
	totalAnnualTax := CalculateAnnualTax(annualTaxable)
	monthlyTax := R(totalAnnualTax / 12)

	// 6. مساهمة الشهداء (0.0005 من الإجمالي)
	martyrs := R(grossSalary * 0.0005)

	// 7. الصافي النهائي (Net Salary)
	// الخصم يشمل: التأمينات + الضريبة + الشهداء + الخصومات الخارجية من الـ Request
	totalDeductionsInternal := insuranceEmployee + monthlyTax + martyrs + deductions
	netSalary := R(grossSalary - totalDeductionsInternal)

	// إرجاع النتيجة بنفس الهيكل اللي الـ Handler مستنيه
	return models.PayrollPayload{
		GrossSalary:       R(grossSalary),
		NetSalary:         R(netSalary),
		TaxAmount:         R(monthlyTax),
		InsuranceEmployee: R(insuranceEmployee),
		InsuranceCompany:  R(insuranceCompany),
		TotalAdditions:    R(additions),
		TotalDeductions:   R(totalDeductionsInternal),
		Details: map[string]interface{}{
			"proratedBasic": proratedBasic,
			"martyrs":       martyrs,
			"taxableIncome": taxableIncome,
			"daysWorked":    days,
		},
	}
}

// CalculateAnnualTax دالة شرائح الضرائب المصرية (تعديل 2025/2026)
func CalculateAnnualTax(taxable float64) float64 {
	if taxable <= 40000 {
		return 0
	}
	
	var tax float64
	remaining := taxable
	
	// مصفوفة الشرائح
	slabs := []struct {
		limit float64
		rate  float64
	}{
		{40000, 0.0},
		{15000, 0.10},
		{15000, 0.15},
		{130000, 0.20},
		{200000, 0.225},
		{400000, 0.25},
	}

	for _, s := range slabs {
		chunk := math.Min(remaining, s.limit)
		tax += chunk * s.rate
		remaining -= chunk
		if remaining <= 0 {
			break
		}
	}
	
	// ما زاد عن أخر شريحة
	if remaining > 0 {
		tax += remaining * 0.275
	}
	
	return tax
}