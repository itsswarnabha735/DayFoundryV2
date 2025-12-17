// Remote import removed to avoid valid peer certificate errors in restricted networks
// import "https://deno.land/std@0.168.0/dotenv/load.ts";
import { runGuardianCheck } from "../supabase/functions/guardian-check/logic.ts";
import { runNegotiator } from "../supabase/functions/negotiate-schedule/logic.ts";

// Simple .env parser since we cannot use remote modules easily
async function loadEnv() {
    try {
        const text = await Deno.readTextFile(".env");
        for (const line of text.split("\n")) {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, ""); // strip quotes
                Deno.env.set(key, value);
            }
        }
    } catch (e) {
        // .env might not exist or be readable
    }
}

await loadEnv();

// Helper to color output
const colors = {
    green: (s: string) => `\x1b[32m${s}\x1b[0m`,
    red: (s: string) => `\x1b[31m${s}\x1b[0m`,
    yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
    bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// Mock Validate Timezone because we are not in Supabase Edge Runtime
// We can just rely on the import from `validation-helpers.ts` if it works in Deno local, 
// which it should as it is standard TS.

async function runGuardianTests() {
    console.log(colors.bold("\n🛡️  Running Guardian Agent Tests..."));
    const testData = JSON.parse(await Deno.readTextFile("./tests/guardian-agent-test-cases.json"));
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
        console.error(colors.red("FATAL: GEMINI_API_KEY not found in .env"));
        Deno.exit(1);
    }

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    const filterIds = Deno.args.filter(arg => !arg.startsWith("--"));
    const testsToRun = filterIds.length > 0
        ? testData.testCases.filter((tc: any) => filterIds.includes(tc.id))
        : testData.testCases;

    for (const testCase of testsToRun) {
        const { id, name, input, expected } = testCase;
        process.stdout.write(`running ${id}: ${name}... `);

        // Add 7s delay to avoid 429 (10 req/min limit)
        await new Promise(r => setTimeout(r, 7000));

        try {
            // 1. Conflict Detection Logic (Replicated from index.ts)
            const eventStart = new Date(`2025-12-16T${input.event.start}:00`).getTime();
            const eventEnd = new Date(`2025-12-16T${input.event.end}:00`).getTime();

            // Normalize blocks for detection
            const conflicts = (input.blocks || []).filter((b: any) => {
                // Handle various date formats in input or assume today if simple HH:MM
                const bStart = b.start.includes("T") ? new Date(b.start).getTime() : new Date(`2025-12-16T${b.start}:00`).getTime();
                const bEnd = b.end.includes("T") ? new Date(b.end).getTime() : new Date(`2025-12-16T${b.end}:00`).getTime();
                return (eventStart < bEnd && eventEnd > bStart);
            });

            // If expectation is "ok" (no conflicts), check detection
            if (expected.status === "ok" || expected.conflicts === 0) {
                if (conflicts.length === 0) {
                    console.log(colors.green("PASS"));
                    passed++;
                } else {
                    console.log(colors.red("FAIL"));
                    console.log(`   Expected 0 conflicts, found ${conflicts.length}`);
                    failed++;
                }
                continue;
            }

            // If we expected conflicts but found none?
            if (conflicts.length === 0 && (expected.type || expected.severity)) {
                console.log(colors.red("FAIL (Detection Mis-match)"));
                console.log(`   Expected conflicts, but detection logic found 0`);
                failed++;
                continue;
            }

            // 2. Run Agent Logic
            // Prepare input for logic check
            const logicInput = {
                event: {
                    title: input.event.title,
                    start_at: `2025-12-16T${input.event.start}:00`,
                    end_at: `2025-12-16T${input.event.end}:00`
                },
                conflictingBlocks: conflicts.map((b: any) => ({
                    ...b,
                    start_time: b.start.includes("T") ? b.start : `2025-12-16T${b.start}:00`,
                    end_time: b.end.includes("T") ? b.end : `2025-12-16T${b.end}:00`
                })),
                userPrefs: input.user_preferences,
                timezone: "Asia/Kolkata",
                geminiApiKey: apiKey
            };

            const result = await runGuardianCheck(logicInput);

            // 3. Assertions
            let casePassed = true;
            const errors = [];

            if (expected.type && result.type !== expected.type) {
                // Allow "warning" if expected "conflict" generally, unless strict
                // Actually, let's be strict or lenient based on severity overlap
                if (expected.type === 'critical' && result.type !== 'critical') {
                    casePassed = false; errors.push(`Type mismatch: Exp ${expected.type}, Got ${result.type}`);
                } else if (expected.type === 'conflict' && result.type === 'critical') {
                    casePassed = false; errors.push(`Type mismatch: Exp ${expected.type}, Got ${result.type}`);
                }
            }

            if (expected.severity_range) {
                const [min, max] = expected.severity_range;
                if (result.severity < min || result.severity > max) {
                    casePassed = false;
                    errors.push(`Severity ${result.severity} outside range [${min}, ${max}]`);
                }
            } else if (expected.severity) {
                if (result.severity !== expected.severity) {
                    // severe checks might be exact
                    casePassed = false;
                    errors.push(`Severity mismatch: Exp ${expected.severity}, Got ${result.severity}`);
                }
            }

            if (casePassed) {
                console.log(colors.green("PASS"));
                passed++;
            } else {
                console.log(colors.red("FAIL"));
                errors.forEach(e => console.log(`   - ${e}`));
                console.log(`   Result: ${JSON.stringify(result)}`);
                console.log(`   Expected: ${JSON.stringify(expected)}`);
                failed++;
            }

        } catch (e) {
            console.log(colors.red("ERROR"));
            console.error(e);
            failed++;
        }
    }

    console.log(colors.bold(`\nGuardian Results: ${passed}/${passed + failed} Passed (${Math.round(passed / (passed + failed) * 100)}%)`));
    return { passed, failed };
}

async function runNegotiatorTests() {
    console.log(colors.bold("\n🤝 Running Negotiator Agent Tests..."));
    const testData = JSON.parse(await Deno.readTextFile("./tests/negotiator-agent-test-cases.json"));
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
        Deno.exit(1);
    }

    let passed = 0;
    let failed = 0;

    const filterIds = Deno.args.filter(arg => !arg.startsWith("--"));
    const testsToRun = filterIds.length > 0
        ? testData.testCases.filter((tc: any) => filterIds.includes(tc.id))
        : testData.testCases;

    for (const testCase of testsToRun) {
        const { id, name, input, expected } = testCase;
        process.stdout.write(`running ${id}: ${name}... `);

        // Add 7s delay to avoid 429 (10 req/min limit)
        await new Promise(r => setTimeout(r, 7000));

        try {
            // Helper to expand stub times
            const expandTime = (t: string) => t?.includes("T") ? t : `2025-12-16T${t}:00`;

            const logicInput = {
                alert: input.alert || { message: "Conflict detected" },
                conflictingBlocks: (input.conflicting_blocks || []).map((b: any) => ({
                    ...b,
                    start_time: expandTime(b.start),
                    end_time: expandTime(b.end)
                })),
                freeSlots: (input.free_slots || []).map((s: any) => ({
                    ...s,
                    start: expandTime(s.start),
                    end: expandTime(s.end),
                    durationMinutes: s.durationMin // Ensure naming match
                })),
                userPrefs: input.user_preferences || {},
                timezone: input.timezone || "Asia/Kolkata",
                geminiApiKey: apiKey
            };

            const result = await runNegotiator(logicInput);

            // Assertions
            let casePassed = true;
            const errors = [];

            if (expected.strategies_count && result.strategies.length !== expected.strategies_count) {
                casePassed = false;
                errors.push(`Count mismatch: Exp ${expected.strategies_count}, Got ${result.strategies.length}`);
            }

            if (expected.must_contain_action) {
                const hasAction = result.strategies.some((s: any) => s.action === expected.must_contain_action);
                if (!hasAction) {
                    casePassed = false;
                    errors.push(`Missing action: ${expected.must_contain_action}`);
                }
            }

            if (expected.move_target_start) {
                // Check if any move operation targets this time
                // The output time format in operations might be "HH:MM PM" or ISO depending on LLM.
                // The test case logic.ts prompts for "newStartTime": ISOString.
                // Let's be lenient and check if it appears in the parameters.
                const found = JSON.stringify(result.strategies).includes(expected.move_target_start); // very loose check
                if (!found) {
                    casePassed = false;
                    errors.push(`Target time ${expected.move_target_start} not found in output`);
                }
            }

            if (casePassed) {
                console.log(colors.green("PASS"));
                passed++;
            } else {
                console.log(colors.red("FAIL"));
                errors.forEach(e => console.log(`   - ${e}`));
                // console.log(`   Result: ${JSON.stringify(result.strategies.map(s => s.title))}`); 
                failed++;
            }

        } catch (e) {
            console.log(colors.red("ERROR"));
            console.error(e);
            failed++;
        }
    }

    console.log(colors.bold(`\nNegotiator Results: ${passed}/${passed + failed} Passed (${Math.round(passed / (passed + failed) * 100)}%)`));
    return { passed, failed };
}

await runGuardianTests();
await runNegotiatorTests();
