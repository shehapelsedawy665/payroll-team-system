const { calculateGrossToNet } = require('../backend/logic/payrollEngine');

describe('Payroll Calculations', () => {
    test('Should calculate correct gross to net', () => {
        const result = calculateGrossToNet({
            basicSalary: 10000,
            variableSalary: 0,
            allowances: 500,
            insSalary: 10000,
            absentDays: 0,
            penaltyDays: 0,
            overtimeHours: 0,
            loanDeduction: 0,
            isTaxExempted: false,
            companySettings: { monthCalcType: 30, dailyWorkHours: 8 },
            jobType: 'Full Time'
        });

        expect(result.grossSalary).toBe(10500);
        expect(result.socialInsuranceEmpShare).toBeGreaterThan(0);
        expect(result.netSalary).toBeLessThan(result.grossSalary);
    });

    test('Should handle absent days correctly', () => {
        const result = calculateGrossToNet({
            basicSalary: 10000,
            variableSalary: 0,
            allowances: 0,
            insSalary: 10000,
            absentDays: 2,  // 2 days absent
            penaltyDays: 0,
            overtimeHours: 0,
            loanDeduction: 0,
            isTaxExempted: false,
            companySettings: { monthCalcType: 30, dailyWorkHours: 8, absentDayRate: 1 },
            jobType: 'Full Time'
        });

        const dayRate = 10000 / 30;
        const expectedDeduction = dayRate * 2;
        expect(result.absenceDeduction).toBe(expectedDeduction);
    });

    test('Insurance salary should respect min/max bounds', () => {
        const result = calculateGrossToNet({
            basicSalary: 5000,
            insSalary: 500, // Below minimum
            companySettings: { monthCalcType: 30 },
            jobType: 'Full Time'
        });

        expect(result.socialInsuranceEmpShare).toBeGreaterThanOrEqual(5384.62 * 0.11);
    });
});