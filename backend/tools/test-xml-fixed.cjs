
const { XMLParser } = require("fast-xml-parser");

const xmlData = `<?xml version="1.0" encoding="utf-8"?>
<ApiResponse>
  <data>
    <ActiveClientDto>
      <customerid>3272</customerid>
      <ClientName>Inditech Valves Pvt Ltd</ClientName>
      <ContactPerson>Mr. Prasad Indi</ContactPerson>
      <ClientAddress>21,Shubham,Prosperity Society,Karvenagar, Pune -411052</ClientAddress>
      <Client_Email>pmi@inditechvalves.com,tejas.bhise@inditechvalves.com</Client_Email>
      <Client_TPhone>7798981331</Client_TPhone>
      <Client_Mobile/>
      <Client_GSTIN>27AAACI8334E1ZP</Client_GSTIN>
      <ClientSize/>
      <Client_AddedOn>3/22/2024 2:30:31 PM</Client_AddedOn>
      <POC/>
      <ServiceNames>Web Designing, Web Hosting-Shared, Website AMC</ServiceNames>
      <LastInvoiceDate>3/11/2026 12:00:00 AM</LastInvoiceDate>
    </ActiveClientDto>
  </data>
</ApiResponse>`;

const parser = new XMLParser();
const jsonObj = parser.parse(xmlData);
console.log("--- PARSED JSON ---");
console.log(JSON.stringify(jsonObj, null, 2));

const clientsList = jsonObj?.ApiResponse?.data?.ActiveClientDto;
console.log("--- EXTRACTED CLIENTS ---");
console.log(JSON.stringify(clientsList, null, 2));
