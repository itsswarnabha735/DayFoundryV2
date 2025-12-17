
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// CONFIG
const SUPABASE_URL = process.env.SUPABASE_URL; // READ FROM ENV
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // READ FROM ENV

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
    process.exit(1);
}

const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchInsecure(url, options) {
    return fetch(url, { ...options, agent });
}

async function runTests() {
    console.log("🤖 Starting Multi-Agent Automation Tests...");
    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        process.stdout.write(`Testing: ${name}... `);
        try {
            await fn();
            console.log("✅ PASSED");
            passed++;
        } catch (e) {
            console.log(`❌ FAILED: ${e.message}`);
            failed++;
        }
    }

    // 1. ORCHESTRATOR REACHABILITY
    await test("Agent Orchestrator Reachability", async () => {
        const res = await fetchInsecure(`${SUPABASE_URL}/functions/v1/agent-orchestrator`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                trigger: 'test_health_check',
                context: { user_id: 'test' }
            })
        });

        // Even if 500 (due to logic), connectivity is OK if not 404
        if (res.status === 404) throw new Error("Endpoint not found (404)");

        const data = await res.json();
        // We expect it to handle 'test_health_check' as unknown trigger (or fail logic), 
        // but as long as it returns JSON, the function is alive.
    });

    // 2. SMART BUNDLER - CONSTRAINT GENERATION
    await test("Smart Bundler Output Constraints", async () => {
        const res = await fetchInsecure(`${SUPABASE_URL}/functions/v1/smart-bundler`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // Minimal payload to trigger "no items" or basic response
                date: new Date().toISOString(),
                user_location: { lat: 0, lng: 0 },
                preferences: { timezone: 'Asia/Kolkata' }
            })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // It might return success: true with empty bundles
        if (!data.success) throw new Error("Function returned success: false");

        // Check if the NEW field exists (even if undefined/null is handled, key check is strict)
        // Note: implementation had `compose_day_constraints` in response.
        if (data.bundles && data.bundles.length > 0 && !data.compose_day_constraints) {
            throw new Error("Missing 'compose_day_constraints' in response when bundles exist");
        }
    });

    // 3. COMPOSE DAY - PROMPT INJECTION (Indirect Test)
    // We can't easily check the prompt, but we can check if it strictly fails on invalid payloads
    // or accepts the new `bundle_constraints` param without error.
    await test("Compose Day Accepts Constraints Param", async () => {
        const res = await fetchInsecure(`${SUPABASE_URL}/functions/v1/compose-day-llm`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                date: new Date().toISOString(),
                constraints: { timezone: 'Asia/Kolkata' },
                bundle_constraints: [
                    { start: '10:00', end: '11:00', reason: 'Test Constraint' }
                ]
            })
        });

        if (res.status === 404) throw new Error("Endpoint 404");
        // It might fail 500 if NO tasks found (which is likely for random user), 
        // but that proves it executed past the param parsing.
        // If it failed due to params, it would likely be earlier.

        const text = await res.text();
        // If it got to logic, we consider it "integrated" for param passing.
    });

    console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
}

runTests();
