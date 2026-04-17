import { describe, expect, it } from "vitest";
import {
    EMAIL_TEMPLATE_IDS,
    normalizeTemplateId,
    normalizeTemplateKey,
    recommendTemplateId,
    wrapInEmailTemplate,
} from "@/shared/lib/email-template";
import { parseCampaignGeneratedOutput } from "@/shared/lib/campaign-output";

describe("campaign template hardening", () => {
    it("normalizes unknown template ids to standard", () => {
        expect(normalizeTemplateId(undefined)).toBe("standard");
        expect(normalizeTemplateId("")).toBe("standard");
        expect(normalizeTemplateId("foo-template")).toBe("standard");
        expect(normalizeTemplateId("modern")).toBe("modern");
    });

    it("parses valid campaign payload and preserves the raw template key", () => {
        const parsed = parseCampaignGeneratedOutput(
            JSON.stringify({
                subject: "Hello from IKF",
                body: "<p>Body</p>",
                templateId: "invalid-template",
            }),
        );

        expect(parsed.subject).toBe("Hello from IKF");
        expect(parsed.body).toBe("<p>Body</p>");
        expect(parsed.raw.templateId).toBe("invalid-template");
        expect(normalizeTemplateId(parsed.raw.templateId)).toBe("standard");
    });

    it("preserves custom template keys through normalization", () => {
        const parsed = parseCampaignGeneratedOutput(
            JSON.stringify({
                subject: "Hello from IKF",
                body: "<p>Body</p>",
                templateId: "custom_test_template_123",
            }),
        );

        expect(normalizeTemplateKey(parsed.raw.templateId)).toBe("custom_test_template_123");
    });

    it("throws controlled errors for malformed generatedOutput payloads", () => {
        expect(() => parseCampaignGeneratedOutput("not-json")).toThrow(
            "Campaign payload is not valid JSON.",
        );
        expect(() =>
            parseCampaignGeneratedOutput(JSON.stringify({ body: "<p>Only body</p>" })),
        ).toThrow("Campaign payload is missing a valid subject.");
        expect(() =>
            parseCampaignGeneratedOutput(JSON.stringify({ subject: "Only subject" })),
        ).toThrow("Campaign payload is missing a valid body.");
    });

    it("renders distinct structural markers for each template", () => {
        const rendered = EMAIL_TEMPLATE_IDS.map((id) =>
            wrapInEmailTemplate(id, "<p>Hello Partner,</p><p>This is a brief.</p>", "Acme", {
                isPreview: true,
            }),
        );
        const uniqueSet = new Set(rendered);
        expect(uniqueSet.size).toBe(EMAIL_TEMPLATE_IDS.length);

        for (let i = 0; i < EMAIL_TEMPLATE_IDS.length; i++) {
            if (EMAIL_TEMPLATE_IDS[i] === "standard") {
                expect(rendered[i]).not.toContain('data-template-id="standard"');
                expect(rendered[i]).not.toContain("hero--standard");
                continue;
            }

            expect(rendered[i]).toContain(`data-template-id=\"${EMAIL_TEMPLATE_IDS[i]}\"`);
            expect(rendered[i]).toContain(`hero--${EMAIL_TEMPLATE_IDS[i]}`);
        }
    });

    it("defaults template recommendations to standard", () => {
        expect(recommendTemplateId({ campaignType: "Broadcast", tone: "Advisory" })).toBe("standard");
        expect(recommendTemplateId({ campaignType: "Reactivation", tone: "Trust-building" })).toBe("standard");
        expect(recommendTemplateId({ campaignType: "Cross-Sell", tone: "Professional" })).toBe("standard");
        expect(recommendTemplateId({ tone: "Premium", coreMessage: "Exclusive strategic insight for your team." })).toBe("standard");
    });

    it("replaces custom template placeholders safely", () => {
        const rendered = wrapInEmailTemplate(
            "custom_test_template_456",
            "<p>Hello Partner,</p><p>This is a brief.</p>",
            "Acme",
            {
                isPreview: true,
                templateSpec: {
                    styles: "/* empty */",
                    layoutHtml: `
{{hero}}
{{intro}}
{{insight}}
{{bullets}}
{{quotes}}
{{remainder}}
{{cta}}
{{signature}}
{{footer}}
{{logo}}
`.trim(),
                },
            },
        );

        expect(rendered).toContain('data-template-id="custom_test_template_456"');
        expect(rendered).toContain("hero--custom");
        expect(rendered).not.toContain("{{hero}}");
        expect(rendered).not.toContain("{{intro}}");
    });
});
