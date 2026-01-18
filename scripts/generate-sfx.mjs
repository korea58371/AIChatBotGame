import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Env manually if not using dotenv
// We assume process.env.ELEVENLABS_API_KEY might be set, OR we read from .env.local manually for this script
// Simplified: We will just try specific paths to read .env.local
const envPath = path.join(__dirname, '../.env.local');
let apiKey = process.env.ELEVENLABS_API_KEY;

if (!apiKey && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/ELEVENLABS_API_KEY=([^\r\n]+)/);
    if (match) {
        apiKey = match[1].trim();
        console.log("Loaded API Key from .env.local");
    }
}

if (!apiKey) {
    console.error("Error: ELEVENLABS_API_KEY not found in environment or .env.local");
    process.exit(1);
}

const SFX_LIST = [
    {
        name: "ui_hover",
        prompt: "Soft distinct high pitch click, minimal user interface hover sound, clean digital blip",
        duration: 0.5
    },
    {
        name: "ui_click",
        prompt: "Sharp clear mechanical mouse click, satisfying modern user interface interaction sound",
        duration: 0.5
    },
    {
        name: "ui_confirm",
        prompt: "Deep cinematic thud mixed with a digital chime, dramatic confirmation sound, positive feedback",
        duration: 1.0
    },
    {
        name: "ui_popup",
        prompt: "Paper page flip, smooth sliding paper sound, book turning, soft swish",
        duration: 0.8
    },
    {
        name: "fx_punch",
        prompt: "Heavy martial arts punch impact, fist hitting flesh, kung fu movie sound effect, thud",
        duration: 1.0
    },
    {
        name: "fx_sword_slash",
        prompt: "Sharp metal sword swish, fast blade cutting air, whoosh sound, high quality weapon swing",
        duration: 1.0
    },
    {
        name: "fx_footstep_dirt",
        prompt: "Single footstep on dry dirt, crunching leaves, soft walking sound on earth",
        duration: 0.5
    },
    {
        name: "fx_energy_charge",
        prompt: "Magical energy gathering, rising hum, sci-fi power up, vibrating air sound",
        duration: 2.0
    }
];

const OUTPUT_DIR = path.join(__dirname, '../public/sfx');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateSfx(item) {
    const url = "https://api.elevenlabs.io/v1/sound-generation";
    const headers = {
        "xi-api-key": apiKey,
        "Content-Type": "application/json"
    };

    const body = {
        text: item.prompt,
        duration_seconds: item.duration,
        prompt_influence: 0.3
    };

    console.log(`Generating: ${item.name} ...`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error: ${response.status} ${err}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const filePath = path.join(OUTPUT_DIR, `${item.name}.mp3`);

        fs.writeFileSync(filePath, buffer);
        console.log(`Saved: ${filePath}`);

    } catch (error) {
        console.error(`Failed to generate ${item.name}:`, error.message);
    }
}

async function main() {
    console.log(`Starting SFX Generation for ${SFX_LIST.length} items...`);
    for (const item of SFX_LIST) {
        // Check if exists to avoid burning credits
        const exists = fs.existsSync(path.join(OUTPUT_DIR, `${item.name}.mp3`));
        if (exists) {
            console.log(`Skipping ${item.name} (Already exists)`);
            continue;
        }
        await generateSfx(item);
        // Rate limit kindness
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log("All operations completed.");
}

main();
