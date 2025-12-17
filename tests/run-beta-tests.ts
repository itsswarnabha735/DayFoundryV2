
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Determine API URL
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

if (!SUPABASE_ANON_KEY) {
    console.error("Error: SUPABASE_ANON_KEY must be set");
    Deno.exit(1);
}

const BETA_ENDPOINT = `${SUPABASE_URL}/functions/v1/compose-day-beta`;

async function runTests() {
    console.log("🚀 Starting Beta Tests against:", BETA_ENDPOINT);

    // Read test cases
    const testCasesRaw = await Deno.readTextFile("./tests/compose-day-llm-test-cases.json");
    const testData = JSON.parse(testCasesRaw);
    const testCases = testData.testCases.slice(0, 5); // Run first 5 for quick feedback

    console.log(`Loading ${testCases.length} tests...`);

    let passed = 0;
    let failed = 0;

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

        try {
            const start = Date.now();
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

            // Basic Validity Check
            if (!result.schedule || !Array.isArray(result.schedule)) {
                console.error(`❌ FAILED: Invalid response format`);
                failed++;
                continue;
            }

            // --- Custom Validation assertions based on 'expected' block ---
            // This is a simplified check. A full assertion library would be better but keeping it simple for now.

            let checksPassed = true;
            const logFail = (msg: string) => {
                console.log(`   Expected: ${JSON.stringify(testCase.expected)}`);
                console.log(`   Actual: ${msg}`);
                checksPassed = false;
            };

            // Check Block Count
            if (testCase.expected.block_count !== undefined) {
                if (result.schedule.length !== testCase.expected.block_count) {
                    logFail(`Block count ${result.schedule.length} != ${testCase.expected.block_count}`);
                }
            }

            // Check Task IDs Present
            if (testCase.expected.task_ids_included) {
                const scheduledIds = result.schedule.flatMap((b: any) => b.taskIds);
                for (const expectedId of testCase.expected.task_ids_included) {
                    if (!scheduledIds.includes(expectedId)) {
                        logFail(`Missing Task ID: ${expectedId}`);
                    }
                }
            }

            if (checksPassed) {
                console.log(`✅ PASSED (${duration}ms)`);
                passed++;
            } else {
                console.log(`❌ FAILED assertions`);
                failed++;
            }

        } catch (e) {
            console.error(`❌ ERROR: ${e.message}`);
            failed++;
        }
    }

    console.log(`\n===================================================`);
    console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log(`===================================================`);
}

runTests();
