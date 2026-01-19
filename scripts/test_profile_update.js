
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Creds");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const USER_ID = '8279fbae-2157-48e1-a5c1-aee90d7b92c2';

async function runTest() {
    console.log(`Testing Profile Update for: ${USER_ID}`);

    // 1. Initial State
    const { data: initial, error: initialError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', USER_ID)
        .single();

    if (initialError) {
        console.error("Initial Fetch Error:", initialError);
        return;
    }
    console.log("Initial Coins:", initial.coins);
    console.log("Initial Fate:", initial.fate_points);

    // 2. Attempt Update
    const newCoins = (initial.coins || 0) + 10;
    console.log(`Attempting to set Coins to: ${newCoins}`);

    const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({ coins: newCoins })
        .eq('id', USER_ID)
        .select()
        .single();

    if (updateError) {
        console.error("Update Error:", updateError);
    } else {
        console.log("Update Return Value:", updated.coins);
    }

    // 3. Verify Read-back
    const { data: verify, error: verifyError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', USER_ID)
        .single();

    if (verifyError) {
        console.error("Verify Error:", verifyError);
    } else {
        console.log("Final Verified Coins:", verify.coins);

        if (verify.coins === initial.coins) {
            console.error("!!! FAIL: Coins did not change! DB ignored update?");
        } else if (verify.coins === newCoins) {
            console.log("!!! SUCCESS: Coins updated successfully.");
        } else {
            console.log("!!! ???: Coins changed to something else:", verify.coins);
        }
    }
}

runTest();
