package calculations

import (
	"math"

	"github.com/shehapelsedawy665/payroll-team-system/models"
)

// R تقريب لأقرب قرشين
func R(n float64) float64 {
	return math.Round(n*100) / 100
}

// CalculateEgyptianPayroll المحرك المالي الاحترافي لعام 2026
func CalculateEgyptianPayroll(emp models.Employee, settings models.CompanySettings, days int, externalAdditions float64, externalDeductions float64) models.PayrollPayload {
	
	// 1. حساب التأمينات الاجتماعية
	insEEPercent := 0.11
	if settings.InsEmployeePercent > 0 {
		insEEPercent = settings.InsEmployeePercent
	}
	
	maxLimit := 16700.0 // حد 2026
	if settings.MaxInsSalary > 0 {
		maxLimit = settings.MaxInsSalary
	}

	insSalary := math.Min(math.Max(emp.SalaryDetails.BasicSalary, 2325), maxLimit)
	insuranceEmployee := R(insSalary * insEEPercent)
	insuranceCompany := R(insSalary * 0.1875)

	// 2. حساب الأيام الفعلية (Proration)
	totalDaysInMonth := 30.0
	if settings.WorkingDays > 0 {
		totalDaysInMonth = float64(settings.WorkingDays)
	}
	proratedBasic := R((emp.SalaryDetails.BasicSalary / totalDaysInMonth) * float64(days))

	// 3. تصنيف الدقيق للإضافات (نقطة التصحيح)
	var taxableAdditions float64       // خاضعة للضريبة
	var medicalAdditions float64       // طبية (تخضع لمعادلة الـ 15%)
	var otherExemptedAdditions float64 // معفاة تماماً (بدلات غير خاضعة)
	
	for _, add := range emp.SalaryDetails.Additions {
		if add.IsMedical {
			medicalAdditions += add.Amount
		} else if add.Type == "Exempted" {
			otherExemptedAdditions += add.Amount
		} else {
			taxableAdditions += add.Amount
		}
	}
	taxableAdditions += externalAdditions // إضافة المبلغ اليدوي من الشاشة

	// 4. إجمالي الاستحقاقات (Gross)
	grossSalary := proratedBasic + taxableAdditions + medicalAdditions + otherExemptedAdditions

	// 5. حساب الوعاء الضريبي (Taxable Income)
	personalExemptionMonthly := settings.PersonalExemption / 12
	if personalExemptionMonthly == 0 {
		personalExemptionMonthly = 20000.0 / 12.0
	}

	// الوعاء قبل خصم الجزء الطبي وقبل خصم البدلات المعفاة تماماً
	// بنطرح التأمينات والإعفاء الشخصي والبدلات المعفاة تماماً الأول
	initialTaxable := grossSalary - insuranceEmployee - personalExemptionMonthly - otherExemptedAdditions - medicalAdditions
	if initialTaxable < 0 { initialTaxable = 0 }

	// تطبيق معادلة الإعفاء الطبي (للميديكال بس)
	medicalLimit := settings.MedicalExemptionLimit / 12
	if medicalLimit == 0 { medicalLimit = 833.33 }
	
	fifteenPercentOfTaxable := initialTaxable * 0.15
	// الإعفاء الطبي هو الأقل بين (15% من الوعاء) أو (قيمة الميديكال فعلياً) أو (الحد القانوني 833)
	appliedMedicalExemption := math.Min(math.Min(fifteenPercentOfTaxable, medicalAdditions), medicalLimit)
	
	// الوعاء النهائي الخاضع للضريبة
	// الوعاء = (الأساسي + الإضافات الخاضعة) - (التأمينات + الإعفاء الشخصي + الإعفاء الطبي المحسوب)
	finalTaxable := math.Max(0, (proratedBasic + taxableAdditions) - insuranceEmployee - personalExemptionMonthly - appliedMedicalExemption)

	// 6. حساب الضريبة السنوية والشهرية
	annualTaxable := math.Floor((finalTaxable * 12)/10) * 10
	totalAnnualTax := CalculateAnnualTax(annualTaxable)
	monthlyTax := R(totalAnnualTax / 12)

	// 7. مساهمة الشهداء والخصومات
	martyrs := R(grossSalary * 0.0005)
	totalDeductions := insuranceEmployee + monthlyTax + martyrs + externalDeductions

	// 8. الصافي النهائي
	netSalary := R(grossSalary - totalDeductions)

	return models.PayrollPayload{
		BasicSalary:              emp.SalaryDetails.BasicSalary,
		GrossSalary:              R(grossSalary),
		NetSalary:                R(netSalary),
		TaxableIncome:            R(finalTaxable),
		TaxAmount:                R(monthlyTax),
		InsuranceEmployee:        R(insuranceEmployee),
		InsuranceCompany:         R(insuranceCompany),
		PersonalExemptionApplied: R(personalExemptionMonthly),
		MedicalExemptionApplied:  R(appliedMedicalExemption),
		WorkingDays:              days,
		TotalAdditions:           R(taxableAdditions + medicalAdditions + otherExemptedAdditions),
		TotalDeductions:          R(totalDeductions),
		Details: map[string]interface{}{
			"martyrs":    martyrs,
			"insSalary":  insSalary,
			"isResigned": emp.Status == "Resigned",
		},
	}
}

// CalculateAnnualTax (نفس الدالة بدون تغيير)
func CalculateAnnualTax(taxable float64) float64 {
	if taxable <= 40000 { return 0 }
	var tax float64
	remaining := taxable
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
		if remaining <= 0 { break }
	}
	if remaining > 0 { tax += remaining * 0.275 }
	return tax
}