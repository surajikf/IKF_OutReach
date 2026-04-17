
function testUrlConstruction(baseUrl, status) {
    const suffix = status === "Y" ? "/GetActiveClients" : "/GetInactiveClients";
    let cleanedBaseUrl = baseUrl.replace(/\/$/, "");
    if (cleanedBaseUrl.includes("?")) {
        cleanedBaseUrl = cleanedBaseUrl.split("?")[0];
    }
    // Using simple string concatenation for test as URL might behave differently in different environments
    const result = cleanedBaseUrl + suffix;
    console.log(`Input: ${baseUrl}, Status: ${status} -> Result: ${result}`);
}

console.log("Testing URL Construction Logic:");
testUrlConstruction("http://192.168.2.79/invoice/api/ApiService.asmx", "Y");
testUrlConstruction("http://192.168.2.79/invoice/api/ApiService.asmx", "N");
testUrlConstruction("http://192.168.2.79/invoice/api/ApiService.asmx/", "Y");
testUrlConstruction("http://192.168.2.79/invoice/api/ApiService.asmx?op=GetClients", "Y");
testUrlConstruction("http://192.168.2.79/invoice/api/ApiService.asmx?op=GetClients", "N");
