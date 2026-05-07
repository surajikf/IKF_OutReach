import { getGlobalSettings } from "@/backend/lib/settings";

async function test() {
    const settings = await getGlobalSettings();
    const apiKey = process.env.BREVO_API_KEY?.trim() || "";
    console.log("Settings Provider:", settings.emailProvider);
    console.log("API Key found:", !!apiKey);
    if (apiKey) {
        console.log("Key Prefix:", apiKey.substring(0, 10));
        console.log("Key Length:", apiKey.length);
    }
    
    const response = await fetch("https://api.brevo.com/v3/senders", {
        method: "GET",
        headers: {
            "accept": "application/json",
            "api-key": apiKey
        }
    });
    
    console.log("Response OK:", response.ok);
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Data:", JSON.stringify(data, null, 2));
}

test().catch(console.error);
