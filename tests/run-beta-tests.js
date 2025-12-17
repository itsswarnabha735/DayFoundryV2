
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_ANON_KEY) {
    console.error("Error: SUPABASE_ANON_KEY must be set in .env");
    process.exit(1);
}

const BETA_ENDPOINT = `${SUPABASE_URL}/functions/v1/compose-day-beta`;

async function runTests() {
    console.log("🚀 Starting Beta Tests against:", BETA_ENDPOINT);

    try {
        const testCasesRaw = fs.readFileSync(path.join(__dirname, 'compose-day-llm-test-cases.json'), 'utf8');
        const testData = JSON.parse(testCasesRaw);
        // Run all tests
        const testCases = testData.testCases;

        console.log(`Loading ${testCases.length} tests...`);

        let passed = 0;
        let failed = 0;
        const total = testCases.length;

        for (const testCase of testCases) {
            console.log(`\n---------------------------------------------------`);
            console.log(`Running [${testCase.id}] ${testCase.name}`);
            console.log(`Description: ${testCase.description}`);

            const payload = {
                test_mode: true,
                date: testCase.input.date,
                constraints: {
                    timezone: testCase.input.timezone,
                    workingHours: {
                        start: testCase.input.user_preferences.working_hours_start,
                        end: testCase.input.user_preferences.working_hours_end
                    },
                    energyPreference: testCase.input.user_preferences.energy_profile
                },
                test_tasks: testCase.input.tasks,
                test_calendar: testCase.input.calendar_events
            };

            const start = Date.now();

            try {
                const response = await fetch(BETA_ENDPOINT, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify(payload)
                });

                const duration = Date.now() - start;

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`❌ FAILED (HTTP ${response.status}): ${errorText}`);
                    failed++;
                    continue;
                }

                const result = await response.json();

                // Response normalization: compose-day-beta returns 'optimizedBlocks'
                const schedule = result.optimizedBlocks || result.schedule;

                if (!schedule || !Array.isArray(schedule)) {
                    console.error(`❌ FAILED: Invalid response format - missing 'optimizedBlocks' or 'schedule'`);
                    console.error(`   Received keys: ${Object.keys(result).join(', ')}`);
                    console.error(`   Preview: ${JSON.stringify(result, null, 2).substring(0, 500)}...`);
                    failed++;
                    continue;
                }

                // Use normalized schedule for validation
                result.schedule = schedule; // Normalize for downstream checks

                let checksPassed = true;
                const logFail = (msg) => {
                    console.log(`   Expected: ${JSON.stringify(testCase.expected)}`);
                    console.log(`   Actual: ${msg}`);
                };

                // Check Block Count
                if (testCase.expected.block_count !== undefined) {
                    if (result.schedule.length !== testCase.expected.block_count) {
                        logFail(`Block count ${result.schedule.length} != ${testCase.expected.block_count}`);
                    }
                }

                // Check Task IDs Present
                if (testCase.expected.task_ids_included) {
                    const scheduledIds = result.schedule.flatMap(b => b.taskIds);
                    for (const expectedId of testCase.expected.task_ids_included) {
                        if (!scheduledIds.includes(expectedId)) {
                            logFail(`Missing Task ID: ${expectedId}`);
                        }
                    }
                }

                const reportAccuracy = result.validationReport?.accuracy;
                const accuracyDisplay = reportAccuracy !== undefined ? `${reportAccuracy}%` : 'N/A';

                if (checksPassed) {
                    console.log(`✅ PASSED (${duration}ms) - Accuracy Score: ${accuracyDisplay}`);
                    passed++;
                } else {
                    console.log(`❌ FAILED assertions - Accuracy Score: ${accuracyDisplay}`);
                    failed++;
                }

            } catch (err) {
                console.error(`❌ NETWORK ERROR: ${err.message}`);
                if (err.cause) console.error(`   Cause:`, err.cause);
                if (err.code) console.error(`   Code: ${err.code}`);
                failed++;
            }
        }

        const accuracy = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
        console.log(`\n===================================================`);
        console.log(`SUMMARY: ${passed}/${total} Passed, ${failed} Failed`);
        console.log(`ACCURACY: ${accuracy}%`);
        console.log(`===================================================`);

    } catch (err) {
        console.error("Fatal Error:", err);
    }
}

runTests();
