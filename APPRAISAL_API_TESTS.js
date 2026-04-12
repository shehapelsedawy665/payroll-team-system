/**
 * @file APPRAISAL_API_TESTS.js
 * @description Test cases for appraisal system API endpoints
 * Run with: node APPRAISAL_API_TESTS.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000/api/appraisal';

// Mock authentication token (should be obtained from login)
const TOKEN = 'your-authentication-token-here';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

class AppraisalAPITester {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    /**
     * Make HTTP request
     */
    async makeRequest(method, path, data = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, BASE_URL);
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TOKEN}`
                }
            };

            const req = http.request(url, options, (res) => {
                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    try {
                        resolve({
                            status: res.statusCode,
                            headers: res.headers,
                            body: responseData ? JSON.parse(responseData) : null
                        });
                    } catch (e) {
                        resolve({
                            status: res.statusCode,
                            headers: res.headers,
                            body: responseData
                        });
                    }
                });
            });

            req.on('error', reject);

            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    /**
     * Assert test result
     */
    assert(testName, condition, expected, actual) {
        const passed = condition;
        const result = {
            name: testName,
            passed,
            expected,
            actual
        };

        this.results.tests.push(result);

        if (passed) {
            this.results.passed++;
            console.log(`${colors.green}✓${colors.reset} ${testName}`);
        } else {
            this.results.failed++;
            console.log(`${colors.red}✗${colors.reset} ${testName}`);
            console.log(`  Expected: ${JSON.stringify(expected)}`);
            console.log(`  Actual: ${JSON.stringify(actual)}`);
        }
    }

    /**
     * Test: Create Appraisal Cycle (requires admin)
     */
    async testCreateCycle() {
        console.log(`\n${colors.cyan}Testing: Create Appraisal Cycle${colors.reset}`);
        
        const cycleData = {
            name: 'Q1 2024 Testing',
            startDate: '2024-01-01',
            endDate: '2024-03-31',
            description: 'Test cycle for API validation'
        };

        try {
            const response = await this.makeRequest('POST', '/cycles', cycleData);
            this.assert(
                'Create cycle returns 201 or 400 status',
                response.status === 201 || response.status === 400,
                '201 or 400',
                response.status
            );

            if (response.status === 201) {
                this.assert(
                    'Response contains cycle data',
                    response.body && response.body.cycle,
                    'cycle object exists',
                    response.body?.cycle ? 'exists' : 'missing'
                );
                return response.body?.cycle?._id;
            }
        } catch (error) {
            console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
        }
    }

    /**
     * Test: Get All Cycles
     */
    async testGetCycles() {
        console.log(`\n${colors.cyan}Testing: Get All Cycles${colors.reset}`);

        try {
            const response = await this.makeRequest('GET', '/cycles');
            this.assert(
                'Get cycles returns 200 status',
                response.status === 200,
                200,
                response.status
            );

            this.assert(
                'Response contains cycles array',
                Array.isArray(response.body?.cycles),
                'array',
                Array.isArray(response.body?.cycles) ? 'array' : typeof response.body?.cycles
            );

            this.assert(
                'Response contains total count',
                typeof response.body?.total === 'number',
                'number',
                typeof response.body?.total
            );
        } catch (error) {
            console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
        }
    }

    /**
     * Test: Create Appraisal Template (requires admin)
     */
    async testCreateTemplate() {
        console.log(`\n${colors.cyan}Testing: Create Appraisal Template${colors.reset}`);

        const templateData = {
            name: 'Standard Competency Framework',
            description: 'Test template with basic competencies',
            competencies: [
                {
                    name: 'Communication',
                    category: 'behavioral',
                    description: 'Ability to communicate effectively',
                    proficiencyLevels: [
                        { level: 1, label: 'Developing', description: 'Needs development' },
                        { level: 2, label: 'Competent', description: 'Meets requirements' },
                        { level: 3, label: 'Proficient', description: 'Exceeds requirements' },
                        { level: 4, label: 'Expert', description: 'Demonstrates expertise' },
                        { level: 5, label: 'Master', description: 'Sets organizational standard' }
                    ],
                    weight: 1
                },
                {
                    name: 'Technical Skills',
                    category: 'technical',
                    description: 'Technical competency and knowledge',
                    proficiencyLevels: [
                        { level: 1, label: 'Developing' },
                        { level: 2, label: 'Competent' },
                        { level: 3, label: 'Proficient' },
                        { level: 4, label: 'Expert' },
                        { level: 5, label: 'Master' }
                    ],
                    weight: 1.5
                }
            ],
            ratingScale: '5-point',
            ratingLevels: [
                { rating: '5-Exceptional', label: 'Exceptional', description: 'Far exceeds expectations', scoreRange: { min: 4.5, max: 5 } },
                { rating: '4-Exceeds', label: 'Exceeds', description: 'Exceeds expectations', scoreRange: { min: 4, max: 4.49 } },
                { rating: '3-Meets', label: 'Meets', description: 'Meets expectations', scoreRange: { min: 3, max: 3.99 } },
                { rating: '2-Below', label: 'Below', description: 'Below expectations', scoreRange: { min: 2, max: 2.99 } },
                { rating: '1-Unsatisfactory', label: 'Unsatisfactory', description: 'Does not meet expectations', scoreRange: { min: 1, max: 1.99 } }
            ]
        };

        try {
            const response = await this.makeRequest('POST', '/templates', templateData);
            this.assert(
                'Create template returns 201 or 400 status',
                response.status === 201 || response.status === 400,
                '201 or 400',
                response.status
            );

            if (response.status === 201) {
                this.assert(
                    'Response contains template data',
                    response.body && response.body.template,
                    'template object exists',
                    response.body?.template ? 'exists' : 'missing'
                );
                return response.body?.template?._id;
            }
        } catch (error) {
            console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
        }
    }

    /**
     * Test: Get Templates
     */
    async testGetTemplates() {
        console.log(`\n${colors.cyan}Testing: Get Templates${colors.reset}`);

        try {
            const response = await this.makeRequest('GET', '/templates');
            this.assert(
                'Get templates returns 200 status',
                response.status === 200,
                200,
                response.status
            );

            this.assert(
                'Response contains templates array',
                Array.isArray(response.body?.templates),
                'array',
                Array.isArray(response.body?.templates) ? 'array' : typeof response.body?.templates
            );
        } catch (error) {
            console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
        }
    }

    /**
     * Test: Get My Appraisals
     */
    async testGetMyAppraisals() {
        console.log(`\n${colors.cyan}Testing: Get My Appraisals${colors.reset}`);

        try {
            const response = await this.makeRequest('GET', '/my-appraisals');
            this.assert(
                'Get my appraisals returns 200 status',
                response.status === 200,
                200,
                response.status
            );

            this.assert(
                'Response contains appraisals array',
                Array.isArray(response.body?.appraisals),
                'array',
                Array.isArray(response.body?.appraisals) ? 'array' : typeof response.body?.appraisals
            );

            this.assert(
                'Response contains total count',
                typeof response.body?.total === 'number',
                'number',
                typeof response.body?.total
            );
        } catch (error) {
            console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
        }
    }

    /**
     * Test: Error Handling - Missing Auth Token
     */
    async testMissingAuth() {
        console.log(`\n${colors.cyan}Testing: Error Handling - Missing Auth${colors.reset}`);

        try {
            const url = new URL('/cycles', BASE_URL);
            const options = {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
                // No Authorization header
            };

            const response = await new Promise((resolve) => {
                const req = http.request(url, options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        resolve({ status: res.statusCode, body: data });
                    });
                });
                req.on('error', () => resolve({ status: 500 }));
                req.end();
            });

            this.assert(
                'Missing auth token returns 401 status',
                response.status === 401 || response.status === 403,
                '401 or 403',
                response.status
            );
        } catch (error) {
            console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
        }
    }

    /**
     * Test: Invalid Route
     */
    async testInvalidRoute() {
        console.log(`\n${colors.cyan}Testing: Error Handling - Invalid Route${colors.reset}`);

        try {
            const response = await this.makeRequest('GET', '/invalid-endpoint');
            this.assert(
                'Invalid route returns 404 status',
                response.status === 404,
                404,
                response.status
            );
        } catch (error) {
            console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
        }
    }

    /**
     * Print Results Summary
     */
    printResults() {
        console.log(`\n${colors.cyan}${'='.repeat(50)}${colors.reset}`);
        console.log(`${colors.cyan}TEST RESULTS SUMMARY${colors.reset}`);
        console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}\n`);

        console.log(`${colors.green}Passed: ${this.results.passed}${colors.reset}`);
        console.log(`${colors.red}Failed: ${this.results.failed}${colors.reset}`);
        console.log(`Total: ${this.results.passed + this.results.failed}\n`);

        const successRate = this.results.passed + this.results.failed > 0
            ? ((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)
            : 0;

        console.log(`Success Rate: ${successRate}%\n`);

        if (this.results.failed > 0) {
            console.log(`${colors.red}Failed Tests:${colors.reset}`);
            this.results.tests
                .filter(t => !t.passed)
                .forEach(t => {
                    console.log(`\n  ${colors.red}✗ ${t.name}${colors.reset}`);
                    console.log(`    Expected: ${JSON.stringify(t.expected)}`);
                    console.log(`    Actual: ${JSON.stringify(t.actual)}`);
                });
        }
    }

    /**
     * Run all tests
     */
    async runAll() {
        console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);
        console.log(`${colors.blue}APPRAISAL API TEST SUITE${colors.reset}`);
        console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);
        console.log(`Base URL: ${BASE_URL}\n`);

        await this.testGetCycles();
        await this.testGetTemplates();
        await this.testGetMyAppraisals();
        await this.testMissingAuth();
        await this.testInvalidRoute();

        this.printResults();

        // Exit with appropriate code
        process.exit(this.results.failed > 0 ? 1 : 0);
    }
}

// Run tests
const tester = new AppraisalAPITester();
tester.runAll().catch(error => {
    console.error(`${colors.red}Fatal Error:${colors.reset}`, error);
    process.exit(1);
});
