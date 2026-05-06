import { describe, expect, it } from "vitest";
import { extractInvoiceClientRows, unwrapInvoiceServicePayload } from "@/backend/lib/invoice-xml";

describe("invoice-xml", () => {
    it("unwraps SOAP GetClientsResult CDATA-ish string into DTOs", () => {
        const inner = `<root><ActiveClientDto><Customerid>1</Customerid><Client_Email>a@b.com</Client_Email><ClientName>Acme</ClientName></ActiveClientDto></root>`;
        const parsed = {
            "soap:Envelope": {
                "soap:Body": {
                    GetClientsResponse: {
                        GetClientsResult: inner,
                    },
                },
            },
        };
        const rows = extractInvoiceClientRows(parsed);
        expect(rows.length).toBe(1);
        expect(String(rows[0].Customerid || rows[0].customerid)).toBe("1");
    });

    it("finds ActiveClientDto at root after unwrap", () => {
        const u = unwrapInvoiceServicePayload({
            ActiveClientDto: {
                Customerid: "2",
                Client_Email: "x@y.com",
                ClientName: "X",
            },
        });
        const rows = extractInvoiceClientRows(u);
        expect(rows.length).toBeGreaterThanOrEqual(1);
    });
});
