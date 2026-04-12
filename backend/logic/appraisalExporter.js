/**
 * @file backend/logic/appraisalExporter.js
 * @description Export appraisal data to PDF, Excel, and other formats
 */

const pdf = require('pdf-kit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

/**
 * Generate PDF appraisal report
 */
async function generateAppraisalPDF(appraisal, employee, company) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdf();
            const filename = path.join('/tmp', `appraisal-${appraisal._id}.pdf`);
            const stream = fs.createWriteStream(filename);

            doc.pipe(stream);

            // Add company header
            doc.fontSize(20).text(company?.name || 'Company', { align: 'center' });
            doc.fontSize(14).text('PERFORMANCE APPRAISAL FORM', { align: 'center' });
            doc.fontSize(10).text(new Date().toLocaleDateString(), { align: 'center' });
            doc.moveDown();

            // Employee Information
            doc.fontSize(12).text('Employee Information', { underline: true });
            doc.fontSize(10)
                .text(`Name: ${employee?.name || 'N/A'}`)
                .text(`Position: ${employee?.jobTitle || 'N/A'}`)
                .text(`Department: ${employee?.department || 'N/A'}`)
                .text(`Employee ID: ${employee?._id || 'N/A'}`);
            doc.moveDown();

            // Ratings
            doc.fontSize(12).text('Performance Ratings', { underline: true });
            doc.fontSize(10);
            
            if (appraisal.scores?.finalRating) {
                doc.text(`Final Rating: ${appraisal.scores.finalRating}`);
            }
            if (appraisal.scores?.calibratedScore) {
                doc.text(`Overall Score: ${appraisal.scores.calibratedScore}/5.0`);
            }
            if (appraisal.scores?.managerRatingScore) {
                doc.text(`Manager Rating: ${appraisal.scores.managerRatingScore}/5.0`);
            }
            if (appraisal.scores?.selfAssessmentScore) {
                doc.text(`Self Assessment: ${appraisal.scores.selfAssessmentScore}/5.0`);
            }
            doc.moveDown();

            // Competency Ratings
            if (appraisal.managerRating?.competencies) {
                doc.fontSize(12).text('Competency Ratings', { underline: true });
                doc.fontSize(10);
                
                appraisal.managerRating.competencies.forEach((comp, idx) => {
                    doc.text(`${idx + 1}. ${comp.competencyName}: ${comp.rating}/5`);
                    if (comp.managerComment) {
                        doc.fontSize(8).text(`   Comment: ${comp.managerComment}`, { width: 500 });
                        doc.fontSize(10);
                    }
                });
                doc.moveDown();
            }

            // Manager Comments
            if (appraisal.managerRating?.overallComment) {
                doc.fontSize(12).text('Manager Comments', { underline: true });
                doc.fontSize(10).text(appraisal.managerRating.overallComment, { width: 500, align: 'left' });
                doc.moveDown();
            }

            // Development Areas
            if (appraisal.managerRating?.developmentAreas) {
                doc.fontSize(12).text('Development Areas', { underline: true });
                doc.fontSize(10).text(appraisal.managerRating.developmentAreas, { width: 500 });
                doc.moveDown();
            }

            // Development Plan
            if (appraisal.developmentPlan?.trainingNeeds?.length > 0) {
                doc.fontSize(12).text('Development Plan', { underline: true });
                doc.fontSize(10);
                appraisal.developmentPlan.trainingNeeds.forEach(need => {
                    doc.text(`• ${need}`);
                });
                doc.moveDown();
            }

            // Signatures area
            doc.moveDown(2);
            doc.fontSize(10)
                .text('___________________', 100)
                .text('Employee Signature', 100, doc.y)
                .text('___________________', 300)
                .text('Manager Signature', 300, doc.y);

            doc.end();

            stream.on('finish', () => {
                resolve(filename);
            });

            stream.on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate Excel report with multiple appraisals
 */
async function generateAppraisalsExcel(appraisals, employees, cycleInfo) {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Appraisals');

        // Add headers
        worksheet.columns = [
            { header: 'Employee ID', key: 'employeeId', width: 15 },
            { header: 'Employee Name', key: 'employeeName', width: 20 },
            { header: 'Department', key: 'department', width: 15 },
            { header: 'Position', key: 'position', width: 20 },
            { header: 'Self Rating', key: 'selfRating', width: 12 },
            { header: 'Manager Rating', key: 'managerRating', width: 12 },
            { header: 'Final Rating', key: 'finalRating', width: 15 },
            { header: 'Overall Score', key: 'overallScore', width: 12 },
            { header: 'Status', key: 'status', width: 12 }
        ];

        // Add data rows
        appraisals.forEach(appraisal => {
            const emp = employees.find(e => e._id.toString() === appraisal.employeeId.toString());
            worksheet.addRow({
                employeeId: emp?._id || '',
                employeeName: emp?.name || '',
                department: emp?.department || '',
                position: emp?.jobTitle || '',
                selfRating: appraisal.scores?.selfAssessmentScore || '',
                managerRating: appraisal.scores?.managerRatingScore || '',
                finalRating: appraisal.scores?.finalRating || '',
                overallScore: appraisal.scores?.calibratedScore || '',
                status: appraisal.status || ''
            });
        });

        // Style header row
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };

        // Save file
        const filename = path.join('/tmp', `appraisals-${Date.now()}.xlsx`);
        await workbook.xlsx.writeFile(filename);

        return filename;
    } catch (error) {
        throw new Error(`Failed to generate Excel report: ${error.message}`);
    }
}

/**
 * Generate calibration report
 */
async function generateCalibrationReport(appraisals, template) {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Calibration');

        // Summary statistics
        const distribution = {
            exceptional: appraisals.filter(a => a.scores?.finalRating === '5-Exceptional').length,
            exceeds: appraisals.filter(a => a.scores?.finalRating === '4-Exceeds').length,
            meets: appraisals.filter(a => a.scores?.finalRating === '3-Meets').length,
            below: appraisals.filter(a => a.scores?.finalRating === '2-Below').length,
            unsatisfactory: appraisals.filter(a => a.scores?.finalRating === '1-Unsatisfactory').length
        };

        worksheet.addRow(['Rating', 'Count', 'Percentage', 'Target %', 'Status']);
        const total = appraisals.length;
        const target = template?.calibrationSettings?.targetDistribution || {
            exceptional: 10,
            exceeds: 20,
            meets: 60,
            below: 8,
            unsatisfactory: 2
        };

        const ratings = [
            { label: 'Exceptional', count: distribution.exceptional, targetPct: target.exceptional },
            { label: 'Exceeds', count: distribution.exceeds, targetPct: target.exceeds },
            { label: 'Meets', count: distribution.meets, targetPct: target.meets },
            { label: 'Below', count: distribution.below, targetPct: target.below },
            { label: 'Unsatisfactory', count: distribution.unsatisfactory, targetPct: target.unsatisfactory }
        ];

        ratings.forEach(rating => {
            const pct = ((rating.count / total) * 100).toFixed(1);
            const deviation = (pct - rating.targetPct).toFixed(1);
            const status = Math.abs(deviation) <= 2 ? '✓ OK' : '⚠ ADJUST';
            
            worksheet.addRow([
                rating.label,
                rating.count,
                pct,
                rating.targetPct,
                status
            ]);
        });

        // Highlight problem areas
        worksheet.getRow(1).font = { bold: true };

        const filename = path.join('/tmp', `calibration-${Date.now()}.xlsx`);
        await workbook.xlsx.writeFile(filename);

        return filename;
    } catch (error) {
        throw new Error(`Failed to generate calibration report: ${error.message}`);
    }
}

/**
 * Generate CSV export for all appraisals
 */
function generateAppraisalsCSV(appraisals, employees) {
    let csv = 'Employee ID,Employee Name,Department,Position,Self Rating,Manager Rating,Final Rating,Overall Score,Status\n';

    appraisals.forEach(appraisal => {
        const emp = employees.find(e => e._id.toString() === appraisal.employeeId.toString());
        const row = [
            emp?._id || '',
            emp?.name || '',
            emp?.department || '',
            emp?.jobTitle || '',
            appraisal.scores?.selfAssessmentScore || '',
            appraisal.scores?.managerRatingScore || '',
            appraisal.scores?.finalRating || '',
            appraisal.scores?.calibratedScore || '',
            appraisal.status || ''
        ].map(val => `"${val}"`).join(',');

        csv += row + '\n';
    });

    return csv;
}

/**
 * Generate JSON export for integration with other systems
 */
function generateAppraisalsJSON(appraisals, employees, cycle) {
    return {
        metadata: {
            cycleId: cycle?._id,
            cycleName: cycle?.name,
            exportDate: new Date().toISOString(),
            totalRecords: appraisals.length
        },
        appraisals: appraisals.map(appraisal => {
            const emp = employees.find(e => e._id.toString() === appraisal.employeeId.toString());
            return {
                appraisalId: appraisal._id,
                employeeId: emp?._id,
                employeeName: emp?.name,
                department: emp?.department,
                position: emp?.jobTitle,
                scores: appraisal.scores,
                status: appraisal.status,
                ratings: {
                    self: appraisal.scores?.selfAssessmentScore,
                    manager: appraisal.scores?.managerRatingScore,
                    calibrated: appraisal.scores?.calibratedScore,
                    final: appraisal.scores?.finalRating
                }
            };
        })
    };
}

module.exports = {
    generateAppraisalPDF,
    generateAppraisalsExcel,
    generateCalibrationReport,
    generateAppraisalsCSV,
    generateAppraisalsJSON
};
