
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

// Load Environment Variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ GEMINI_API_KEY not found.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

async function main() {
    try {
        // Accessing the underlying fetching mechanism if exposed, or just try to generate with known models
        // SDK doesn't always expose listModels directly on the main class in Node? 
        // Actually it's usually separate.
        // Let's brute force check common names.

        // But better, create a dummy model and print error?
        // Or check documentation logic.
        // Actually, Node SDK doesn't have listModels? It SHOULD.
        // Let's simpler: Use fetch directly.

        console.log("Listing models via REST API...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach((m: any) => {
                if (m.name.includes('gemini') || m.name.includes('flash')) {
                    console.log(`- ${m.name} (${m.displayName})`);
                }
            });
        } else {
            console.log("No models returned:", data);
        }

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

main();
