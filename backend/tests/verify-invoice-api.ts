
function testUrlConstruction(baseUrl: string, status: "Y" | "N") {
    const suffix = status === "Y" ? "/GetActiveClients" : "/GetInactiveClients";
    let cleanedBaseUrl = baseUrl.replace(/\/$/, "");
    if (cleanedBaseUrl.includes("?")) {
        cleanedBaseUrl = cleanedBaseUrl.split("?")[0];
    }
    const endpoint = new URL(cleanedBaseUrl + suffix);
    console.log(`Input: ${baseUrl}, Status: ${status} -> Result: ${endpoint.toString()}`);
}

console.log("Testing URL Construction Logic:");
testUrlConstruction("http://192.168.2.79/invoice/api/ApiService.asmx", "Y");
testUrlConstruction("http://192.168.2.79/invoice/api/ApiService.asmx", "N");
testUrlConstruction("http://192.168.2.79/invoice/api/ApiService.asmx/", "Y");
testUrlConstruction("http://192.168.2.79/invoice/api/ApiService.asmx?op=GetClients", "Y");
testUrlConstruction("http://192.168.2.79/invoice/api/ApiService.asmx?op=GetClients", "N");
