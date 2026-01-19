
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
            process.env[key] = value;
        }
    });
}

// CONFIGURATION
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // MUST use Service Role Key for Admin Rights

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function generateCode(prefix: string): string {
    // Format: PREFIX-XXXX-XXXX
    // 4 random chars per block (A-Z, 0-9)
    const block = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${block()}-${block()}`;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.log("Usage: ts-node generate_coupons.ts <PREFIX> <COUNT> <TYPE> [REWARDS_JSON]");
        console.log("Example: ts-node generate_coupons.ts ADVENTURER 100 fixed_reward '{\"tokens\":1500, \"fate_points\":500}'");
        process.exit(1);
    }

    const prefix = args[0].toUpperCase();
    const count = parseInt(args[1], 10);
    const type = args[2];
    const rewardsJson = args[3] || '{}';

    let rewards;
    try {
        rewards = JSON.parse(rewardsJson);
    } catch (e) {
        console.error("Invalid JSON for rewards");
        process.exit(1);
    }

    console.log(`Generating ${count} coupons with prefix ${prefix}...`);
    console.log(`Rewards:`, rewards);

    const coupons = [];
    const csvRows = ['Coupon Code, Type, Rewards']; // Header

    for (let i = 0; i < count; i++) {
        const code = generateCode(prefix);
        coupons.push({
            code,
            type,
            value: rewards,
            max_uses: 1, // Unique keys usually 1 use
            used_count: 0
        });
        // Format JSON for CSV readability if needed, or just stringify
        csvRows.push(`${code},${type},"${JSON.stringify(rewards).replace(/"/g, '""')}"`);
    }

    // Batch Insert (Chunking to avoid payload limits if count is large)
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < coupons.length; i += CHUNK_SIZE) {
        const chunk = coupons.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('coupons').insert(chunk);
        if (error) {
            console.error("Error inserting chunk:", error);
            process.exit(1);
        }
        console.log(`Inserted chunk ${i / CHUNK_SIZE + 1} / ${Math.ceil(coupons.length / CHUNK_SIZE)}`);
    }

    // Export CSV
    const fileName = `coupons_${prefix}_${count}_${Date.now()}.csv`;
    const filePath = path.join(process.cwd(), fileName);
    fs.writeFileSync(filePath, csvRows.join('\n'));

    console.log(`Success! ${count} coupons generated.`);
    console.log(`CSV Exported to: ${filePath}`);
}

main();
