package calculations

import (
	"math"
)

// R هي دالة لتقريب الأرقام لأقرب قرشين (Round to 2 decimal places)
func R(n float64) float64 {
	return math.Round(n*100) / 100
}

// Input الهيكل المتوقع للبيانات المدخلة
type Input struct {
	FullBasic  float64
	FullTrans  float64
	Days       float64
	Additions  []Component
	Deductions []Component
}

// Component بند مالي (بدل أو خصم)
type Component struct {
	Name      string
	Amount    float64
	Type      string // Exempted, Non-Exempted
	IsMedical bool
}

// Settings إعدادات الضرائب والتأمينات
type Settings struct {
	InsEmployeePercent float64
	MaxInsSalary       float64
	MinInsSalary       float64
	PersonalExemption  float64
}

// PayrollResult نتيجة الحسابات
type PayrollResult struct {
	ProratedBasic        float64
	ProratedTrans        float64
	Gross                float64
	InsuranceEmployee    float64
	MonthlyTax           float64
	Martyrs              float64
	TotalOtherDeductions float64
	Net                  float64
	CurrentTaxable       float64
	AnnualTaxable        float64
}

// RunPayrollLogic المحرك الأساسي لحساب الراتب
func RunPayrollLogic(input Input, prevTaxable float64, prevDays float64, prevTaxes float64, insSalaryBase float64, settings Settings) PayrollResult {
	// 1. الإعدادات الافتراضية
	insEEPercent := 0.11
	if settings.InsEmployeePercent > 0 {
		insEEPercent = settings.InsEmployeePercent
	}
	
	maxLimit := 16700.0
	if settings.MaxInsSalary > 0 {
		maxLimit = settings.MaxInsSalary
	}

	// 2. حساب التأمينات
	insSalary := math.Min(math.Max(insSalaryBase, 2325), maxLimit)
	insuranceEmployee := R(insSalary * insEEPercent)

	// 3. الأيام الفعلية
	finalDays := input.Days
	if finalDays > 30 {
		finalDays = 30
	}

	// 4. إجمالي الاستحقاقات (Gross)
	proratedBasic := R((input.FullBasic / 30) * finalDays)
	proratedTrans := R((input.FullTrans / 30) * finalDays)
	
	totalAdditions := 0.0
	taxableAdditions := 0.0
	for _, a := range input.Additions {
		totalAdditions += a.Amount
		if a.Type == "Non-Exempted" {
			taxableAdditions += a.Amount
		}
	}
	gross := R(proratedBasic + proratedTrans + totalAdditions)

	// 5. الوعاء الضريبي والتأمين الطبي
	taxableBaseBeforeMedical := math.Max(0, (proratedBasic + proratedTrans + taxableAdditions) - insuranceEmployee)
	
	medicalExemption := 0.0
	actualMedicalAmount := 0.0
	hasMedical := false
	for _, d := range input.Deductions {
		if d.IsMedical && d.Type == "Exempted" {
			actualMedicalAmount += d.Amount
			hasMedical = true
		}
	}

	if hasMedical {
		fifteenPercentLimit := R(taxableBaseBeforeMedical * 0.15)
		monthlyMedicalLimit := R(10000.0 / 12.0)
		medicalExemption = math.Min(actualMedicalAmount, math.Min(fifteenPercentLimit, monthlyMedicalLimit))
	}

	currentTaxable := math.Max(0, taxableBaseBeforeMedical - medicalExemption)

	// 6. الضرائب السنوية (YTD)
	totalDaysSoFar := prevDays + finalDays
	totalTaxableSoFar := prevTaxable + currentTaxable
	
	avgDailyTaxable := 0.0
	if totalDaysSoFar > 0 {
		avgDailyTaxable = totalTaxableSoFar / totalDaysSoFar
	}
	
	annualPersonalExemption := 20000.0
	if settings.PersonalExemption > 0 {
		annualPersonalExemption = settings.PersonalExemption
	}

	estimatedAnnualTaxable := (avgDailyTaxable * 360) - annualPersonalExemption
	finalAnnualTaxable := math.Floor(math.Max(0, estimatedAnnualTaxable)/10) * 10

	totalAnnualTax := CalculateAnnualTax(finalAnnualTaxable)
	totalTaxDueUntilNow := (totalAnnualTax / 360) * totalDaysSoFar
	monthlyTax := R(math.Max(0, totalTaxDueUntilNow - prevTaxes))

	// 7. الصافي (Net)
	martyrs := R(gross * 0.0005)
	totalOtherDeductions := 0.0
	for _, d := range input.Deductions {
		totalOtherDeductions += d.Amount
	}

	net := R(gross - (insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions))

	return PayrollResult{
		ProratedBasic:     proratedBasic,
		ProratedTrans:     proratedTrans,
		Gross:             gross,
		InsuranceEmployee: insuranceEmployee,
		MonthlyTax:        monthlyTax,
		Martyrs:           martyrs,
		TotalOtherDeductions: totalOtherDeductions,
		Net:               net,
		CurrentTaxable:    currentTaxable,
		AnnualTaxable:     finalAnnualTaxable,
	}
}

// CalculateAnnualTax دالة شرائح الضرائب المصرية
func CalculateAnnualTax(taxable float64) float64 {
	if taxable <= 40000 { return 0 }
	if taxable > 1200000 {
		return (taxable-1200000)*0.275 + 306500
	}

	var tax float64
	remaining := taxable
	slabs := []struct {
		limit float64
		rate  float64
	}{
		{40000, 0}, {15000, 0.10}, {15000, 0.15}, {130000, 0.20}, {200000, 0.225}, {400000, 0.25},
	}

	for _, s := range slabs {
		chunk := math.Min(remaining, s.limit)
		tax += chunk * s.rate
		remaining -= chunk
		if remaining <= 0 { break }
	}
	if remaining > 0 {
		tax += remaining * 0.275
	}
	return tax
}

// CalculateNetToGross تحويل الصافي لإجمالي (Iteration Method)
func CalculateNetToGross(targetNet float64, settings Settings) float64 {
	low := targetNet
	high := targetNet * 5
	estimatedGross := targetNet
	
	for i := 0; i < 50; i++ {
		input := Input{FullBasic: estimatedGross, Days: 30}
		// بنفترض إن الراتب التأميني هو نفسه الإجمالي للتبسيط في الحسبة دي
		res := RunPayrollLogic(input, 0, 30, 0, estimatedGross, settings)
		
		if math.Abs(res.Net - targetNet) < 0.1 {
			break
		}
		if res.Net < targetNet {
			low = estimatedGross
		} else {
			high = estimatedGross
		}
		estimatedGross = (low + high) / 2
	}
	return R(estimatedGross)
}
