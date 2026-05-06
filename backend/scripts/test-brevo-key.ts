import { getGlobalSettings } from "@/backend/lib/settings";

async function test() {
    const settings = await getGlobalSettings();
    console.log("Settings Provider:", settings.emailProvider);
    console.log("API Key found:", !!settings.brevoApiKey);
    if (settings.brevoApiKey) {
        console.log("Key Prefix:", settings.brevoApiKey.substring(0, 10));
        console.log("Key Length:", settings.brevoApiKey.length);
    }
    
    const response = await fetch("https://api.brevo.com/v3/senders", {
        method: "GET",
        headers: {
            "accept": "application/json",
            "api-key": settings.brevoApiKey
        }
    });
    
    console.log("Response OK:", response.ok);
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Data:", JSON.stringify(data, null, 2));
}

test().catch(console.error);
