package calculations

import (
	"math"
	"time"

	"github.com/shehapelsedawy665/payroll-team-system/models"
)

// R تقريب لأقرب قرشين لضمان دقة الحسابات المالية
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
	
	maxLimit := 16700.0 // حد تأمينات 2026
	if settings.MaxInsSalary > 0 {
		maxLimit = settings.MaxInsSalary
	}

	insSalary := math.Min(math.Max(emp.SalaryDetails.BasicSalary, 2325), maxLimit)
	insuranceEmployee := R(insSalary * insEEPercent)
	insuranceCompany := R(insSalary * 0.1875)

	// 2. حساب الأيام الفعلية والرواتب النسبية
	totalDaysInMonth := 30.0
	if settings.WorkingDays > 0 {
		totalDaysInMonth = float64(settings.WorkingDays)
	}
	
	proratedBasic := R((emp.SalaryDetails.BasicSalary / totalDaysInMonth) * float64(days))
	proratedTransportation := R((emp.SalaryDetails.Transportation / totalDaysInMonth) * float64(days))

	// 3. تصنيف الإضافات والبدلات
	var taxableAdditions float64
	var medicalAdditions float64
	var otherExemptedAdditions float64
	var additionsList []models.PayrollAdjustment

	for _, add := range emp.SalaryDetails.Additions {
		additionsList = append(additionsList, models.PayrollAdjustment{
			Name: add.Name, Amount: add.Amount, IsExempted: add.Type == "Exempted" || add.IsMedical,
		})
		
		if add.IsMedical {
			medicalAdditions += add.Amount
		} else if add.Type == "Exempted" {
			otherExemptedAdditions += add.Amount
		} else {
			taxableAdditions += add.Amount
		}
	}
	
	if externalAdditions > 0 {
		taxableAdditions += externalAdditions
	}

	// 4. إجمالي الاستحقاقات (Gross Salary)
	grossSalary := proratedBasic + proratedTransportation + taxableAdditions + medicalAdditions + otherExemptedAdditions

	// 5. حساب الوعاء الضريبي والإعفاءات
	personalExemptionMonthly := settings.PersonalExemption / 12
	if personalExemptionMonthly == 0 {
		personalExemptionMonthly = 20000.0 / 12.0
	}

	initialTaxableForMedical := (proratedBasic + taxableAdditions) - insuranceEmployee - personalExemptionMonthly
	if initialTaxableForMedical < 0 { initialTaxableForMedical = 0 }

	medicalLimit := settings.MedicalExemptionLimit / 12
	if medicalLimit == 0 { medicalLimit = 833.33 }
	
	fifteenPercentOfTaxable := initialTaxableForMedical * 0.15
	
	appliedMedicalExemption := math.Min(math.Min(fifteenPercentOfTaxable, medicalAdditions), medicalLimit)
	if appliedMedicalExemption < 0 { appliedMedicalExemption = 0 }

	finalTaxable := math.Max(0, initialTaxableForMedical - appliedMedicalExemption)

	// 6. حساب الضريبة السنوية والشهرية
	annualTaxable := math.Floor((finalTaxable * 12)/10) * 10
	totalAnnualTax := CalculateAnnualTax(annualTaxable)
	monthlyTax := R(totalAnnualTax / 12)

	// 7. مساهمة الشهداء والخصومات
	martyrs := R(grossSalary * 0.0005)
	
	var deductionsList []models.PayrollAdjustment
	for _, ded := range emp.SalaryDetails.Deductions {
		deductionsList = append(deductionsList, models.PayrollAdjustment{
			Name: ded.Name, Amount: ded.Amount, IsExempted: ded.Type == "Exempted",
		})
	}
	
	totalDeductions := insuranceEmployee + monthlyTax + martyrs + externalDeductions

	// 8. الصافي النهائي (Net Salary)
	netSalary := R(grossSalary - totalDeductions)

	return models.PayrollPayload{
		FullBasic:                emp.SalaryDetails.BasicSalary,
		FullTransportation:       emp.SalaryDetails.Transportation,
		WorkingDays:              days,
		ProratedBasic:            proratedBasic,
		ProratedTransportation:   proratedTransportation,
		AdditionsList:            additionsList,
		DeductionsList:           deductionsList,
		TotalAdditions:           R(taxableAdditions + medicalAdditions + otherExemptedAdditions),
		TotalDeductions:          R(totalDeductions),
		GrossSalary:              R(grossSalary),
		NetSalary:                R(netSalary),
		TaxableIncome:            R(finalTaxable),
		TaxAmount:                R(monthlyTax),
		InsuranceSalary:          R(insSalary),
		InsuranceEmployee:        R(insuranceEmployee),
		InsuranceCompany:         R(insuranceCompany),
		PersonalExemptionApplied: R(personalExemptionMonthly),
		MedicalExemptionApplied:  R(appliedMedicalExemption),
		MartyrsFund:              R(martyrs),
	}
}

// CalculateAnnualTax حساب شرائح الضرائب المصرية 2026
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