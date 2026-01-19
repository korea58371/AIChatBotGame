
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Load env from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase Credentials (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkProfile(emailOrId) {
    console.log(`Checking profile for: ${emailOrId}`);

    let userId = emailOrId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(emailOrId);

    if (!isUuid) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (error) {
            console.error("List Users Error:", error);
            return;
        }
        const found = users.find(u => u.email === emailOrId);
        if (found) {
            userId = found.id;
            console.log(`Resolved Email ${emailOrId} to UUID ${userId}`);
        } else {
            console.log(`User not found by email: ${emailOrId}`);
            return;
        }
    }

    // Fetch Profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (profileError) {
        console.error("Profile Fetch Error:", profileError);
    } else {
        console.log("---------------------------------------------------");
        console.log("USER PROFILE:");
        console.log(profile);
        console.log("---------------------------------------------------");
    }

    // Check Coupons Redemptions
    const { data: redemptions, error: redemptionsError } = await supabase
        .from('coupon_redemptions')
        .select('*')
        .eq('user_id', userId);

    if (redemptionsError) {
        console.error("Redemptions Fetch Error:", redemptionsError);
    } else {
        console.log(`Redemptions (${redemptions?.length || 0}):`);
        console.table(redemptions);
    }
}

const target = process.argv[2];
if (!target) {
    console.log("Usage: node scripts/debug_user_profile.js <user_id_or_email>");
} else {
    checkProfile(target);
}
