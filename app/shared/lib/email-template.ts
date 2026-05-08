import { sanitizeEmailHtml } from "@/shared/lib/email-sanitize";

export const EMAIL_TEMPLATE_IDS = ["standard", "premium", "minimal", "corporate", "modern", "warm"] as const;
export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export type EmailTemplateKey = EmailTemplateId | string;

export type EmailTemplateSpec = {
    styles: string;
    layoutHtml: string;
};

export const EMAIL_TEMPLATE_OPTIONS: Array<{ id: EmailTemplateId; name: string; description: string }> = [
    { id: "standard", name: "Standard Email", description: "Normal HTML email layout (no template re-structuring)." },
    { id: "premium", name: "Luxury Editorial", description: "Serif-led premium editorial with spacious hierarchy." },
    { id: "modern", name: "Bold Modern", description: "High-contrast blocks, kinetic accents, and assertive CTA framing." },
    { id: "warm", name: "Warm Storyline", description: "Human-centered narrative structure with relationship tone." },
    { id: "corporate", name: "Corporate Briefing", description: "Enterprise briefing format with clear strategic modules." },
    { id: "minimal", name: "Minimal Rail", description: "Ultra-clean text-first modular layout with restraint." },
];

export function isEmailTemplateId(value: unknown): value is EmailTemplateId {
    return typeof value === "string" && (EMAIL_TEMPLATE_IDS as readonly string[]).includes(value);
}

export function normalizeTemplateId(value: unknown): EmailTemplateId {
    return isEmailTemplateId(value) ? value : "standard";
}

export function isCustomTemplateKey(value: unknown): value is string {
    return typeof value === "string" && value.startsWith("custom_");
}

export function normalizeTemplateKey(value: unknown): EmailTemplateId | string {
    if (isEmailTemplateId(value)) return value;
    if (isCustomTemplateKey(value)) return value;
    return "standard";
}

export function recommendTemplateId(input: {
    campaignType?: string | null;
    tone?: string | null;
    coreMessage?: string | null;
    hasBullets?: boolean;
}): EmailTemplateId {
    // Default behavior: keep a normal email format (no forced restructuring).
    // Users can still switch to a styled template explicitly if they want.
    return "standard";
}

type ParsedSections = {
    intro: string[];
    bullets: string[];
    quotes: string[];
    remainder: string[];
};

function htmlEscape(input: string) {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function extractSectionsFromBody(content: string): ParsedSections {
    const paragraphMatches = [...content.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[0]);
    const listItemMatches = [...content.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1].replace(/<[^>]*>/g, "").trim()).filter(Boolean);
    const quoteMatches = [...content.matchAll(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi)].map((m) => m[0]);

    const intro = paragraphMatches.slice(0, 2);
    const remainder = paragraphMatches.slice(2);
    const bullets = listItemMatches.slice(0, 4);
    const quotes = quoteMatches.slice(0, 1);

    return { intro, bullets, quotes, remainder };
}

function renderIntroBlock(items: string[]) {
    if (items.length === 0) return "";
    return `<section class="intro-block">${items.join("")}</section>`;
}

function renderInsightBlock(topic: string, recipientName: string) {
    return `
<section class="insight-block">
  <h3>Strategic Insight</h3>
  <p>This note is tailored for ${htmlEscape(recipientName || "your team")} around <strong>${htmlEscape(topic)}</strong> with practical execution context.</p>
</section>`.trim();
}

function renderBulletPanel(items: string[]) {
    if (items.length === 0) return "";
    return `
<section class="bullet-panel">
  <h3>Key Moves</h3>
  <ul>
    ${items.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}
  </ul>
</section>`.trim();
}

function renderQuotePanel(items: string[]) {
    if (items.length === 0) return "";
    return `<section class="quote-panel">${items.join("")}</section>`;
}

function renderBodyRemainder(items: string[]) {
    if (items.length === 0) return "";
    return `<section class="body-remainder">${items.join("")}</section>`;
}

function renderCtaPanel() {
    return `
<section class="cta-panel">
  <h3>Next Step</h3>
  <p>If this direction is relevant, we can align on a focused rollout plan and timeline.</p>
</section>`.trim();
}

function renderHero(
    templateId: EmailTemplateId,
    logoSrc: string,
    recipientName: string,
    options?: { includeLogo?: boolean },
) {
    const includeLogo = options?.includeLogo ?? true;
    const labelMap: Record<EmailTemplateId, string> = {
        standard: "StandardEmail",
        premium: "LuxuryEditorial",
        modern: "BoldModern",
        warm: "WarmStoryline",
        corporate: "CorporateBriefing",
        minimal: "MinimalRail",
    };
    const logoCell = includeLogo
        ? `
      <td class="hero-logo-cell" valign="top" align="right">
        <img src="${logoSrc}" alt="I Knowledge Factory Pvt. Ltd." class="logo" width="92">
      </td>`
        : "";

    return `
<header class="hero hero--${templateId}">
  <div class="hero-topline">${labelMap[templateId]}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="hero-table">
    <tr>
      <td class="hero-copy-cell" valign="top"${includeLogo ? "" : ` colspan="2"`}>
        <div class="hero-copy">
          <h1>Strategic Message Brief</h1>
          <p>Prepared for ${htmlEscape(recipientName || "Valued Partner")}</p>
        </div>
      </td>
      ${logoCell}
    </tr>
  </table>
</header>`.trim();
}

function getTemplateStyles(templateId: EmailTemplateId) {
    const base = `
body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
.email-container{max-width:700px;margin:28px auto;overflow:hidden}
.hero{padding:28px 34px}
.hero-topline{font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;margin-bottom:16px}
.hero-table{border-collapse:collapse}
.hero-copy-cell{width:100%}
.hero-logo-cell{width:110px}
.hero-copy h1{margin:0 0 6px;font-size:26px;line-height:1.2}
.hero-copy p{margin:0;font-size:13px}
.logo{display:block;width:92px;max-width:92px;height:auto;max-height:none;border:0;outline:none;text-decoration:none}
.content-body{padding:28px 34px}
.content-body p{margin:0 0 14px}
.intro-block,.insight-block,.bullet-panel,.quote-panel,.body-remainder,.cta-panel{margin-bottom:18px}
.insight-block h3,.bullet-panel h3,.cta-panel h3{margin:0 0 8px;font-size:14px;letter-spacing:.04em;text-transform:uppercase}
.bullet-panel ul{margin:0;padding-left:18px}
.bullet-panel li{margin-bottom:7px}
.quote-panel blockquote{margin:0;padding:12px 14px}
.executive-signature{margin-top:18px;padding-top:14px}
.signature-name{font-size:18px;font-weight:700}
.signature-title{font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.footer{padding:18px 34px}
.footer-text{font-size:11px;line-height:1.6}
@media (max-width:600px){
  .email-container{margin:0;border:none}
  .hero,.content-body,.footer{padding:20px}
  .hero-logo-cell{width:84px}
  .logo{width:72px;max-width:72px}
}
`;

    if (templateId === "premium") {
        return `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Outfit:wght@400;500;600&display=swap');
${base}
body{background:#f8f8f7}
.email-container{background:#fff;border:1px solid #e7e5e4;box-shadow:0 10px 30px rgba(0,0,0,.06)}
.hero--premium{background:linear-gradient(180deg,#f9f5ef 0%,#ffffff 100%)}
.hero--premium .hero-topline{color:#8b5e34}
.hero--premium h1{font-family:'Cormorant Garamond',serif;color:#1c1917}
.hero--premium p,.content-body{font-family:'Outfit',sans-serif;color:#292524}
.insight-block,.cta-panel{background:#faf7f3;border:1px solid #efe7dc;padding:14px}
.quote-panel blockquote{border-left:4px solid #a16207;background:#fffbeb}
.executive-signature{border-top:1px solid #e7e5e4}
.signature-name{font-family:'Cormorant Garamond',serif;color:#7c2d12}
.footer{background:#fafaf9;border-top:1px solid #e7e5e4}
`;
    }

    if (templateId === "modern") {
        return `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap');
${base}
body{background:#eef2ff}
.email-container{background:#fff;border:1px solid #c7d2fe;border-radius:14px}
.hero--modern{background:linear-gradient(135deg,#1d4ed8,#7c3aed)}
.hero--modern .hero-topline,.hero--modern h1,.hero--modern p{color:#fff;font-family:'Manrope',sans-serif}
.content-body{font-family:'Manrope',sans-serif;color:#0f172a}
.insight-block{border-left:4px solid #2563eb;background:#eff6ff;padding:12px}
.bullet-panel{background:#f8fafc;border:1px solid #dbeafe;padding:12px}
.cta-panel{background:#1e293b;color:#fff;padding:14px;border-radius:10px}
.cta-panel h3{color:#93c5fd}
.quote-panel blockquote{background:#ede9fe;border-left:4px solid #7c3aed}
.executive-signature{border-top:1px dashed #93c5fd}
.footer{background:#f8fafc;border-top:1px solid #e2e8f0}
`;
    }

    if (templateId === "warm") {
        return `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Merriweather:wght@700&display=swap');
${base}
body{background:#fff7ed}
.email-container{background:#fff;border:1px solid #fed7aa}
.hero--warm{background:linear-gradient(180deg,#fff1e6 0%,#ffffff 100%)}
.hero--warm .hero-topline{color:#c2410c}
.hero--warm h1{font-family:'Merriweather',serif;color:#7c2d12}
.hero--warm p,.content-body{font-family:'Nunito',sans-serif;color:#431407}
.insight-block{background:#fffbeb;border:1px solid #fde68a;padding:12px}
.bullet-panel{background:#fff7ed;border:1px solid #fdba74;padding:12px}
.cta-panel{background:#9a3412;color:#fff;padding:14px}
.cta-panel h3{color:#fed7aa}
.quote-panel blockquote{border-left:4px solid #ea580c;background:#fff1e6}
.executive-signature{border-top:1px solid #fed7aa}
.footer{background:#fff7ed;border-top:1px solid #fed7aa}
`;
    }

    if (templateId === "corporate") {
        return `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
${base}
body{background:#f1f5f9}
.email-container{background:#fff;border:1px solid #cbd5e1}
.hero--corporate{background:#0f172a}
.hero--corporate .hero-topline,.hero--corporate h1,.hero--corporate p{color:#e2e8f0;font-family:'IBM Plex Sans',sans-serif}
.content-body{font-family:'IBM Plex Sans',sans-serif;color:#0f172a}
.insight-block,.bullet-panel,.cta-panel{border:1px solid #cbd5e1;background:#f8fafc;padding:12px}
.quote-panel blockquote{border-left:4px solid #334155;background:#f1f5f9}
.executive-signature{border-top:2px solid #cbd5e1}
.footer{background:#f8fafc;border-top:1px solid #cbd5e1}
`;
    }

    return `
@import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&display=swap');
${base}
body{background:#f8fafc}
.email-container{background:#fff;border:1px solid #e2e8f0}
.hero--minimal{background:#ffffff;border-bottom:1px solid #e2e8f0}
.hero--minimal .hero-topline{color:#64748b}
.hero--minimal h1,.hero--minimal p,.content-body{font-family:'Source Sans 3',sans-serif;color:#0f172a}
.insight-block,.bullet-panel,.cta-panel{border-left:3px solid #94a3b8;padding:10px 12px;background:#ffffff}
.quote-panel blockquote{border-left:3px solid #64748b;background:#f8fafc}
.executive-signature{border-top:1px solid #e2e8f0}
.footer{background:#ffffff;border-top:1px solid #e2e8f0}
`;
}

function baseShell(params: {
    title: string;
    recipientName: string;
    styles: string;
    hero: string;
    introBlock: string;
    insightBlock: string;
    bulletPanel: string;
    quotePanel: string;
    bodyRemainder: string;
    ctaPanel: string;
    signatureName: string;
    signatureTitle: string;
    footerNote: string;
    templateId: EmailTemplateId;
}) {
    const year = new Date().getFullYear();
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title}</title>
  <style>
    ${params.styles}
  </style>
</head>
<body>
  <div class="email-container" data-template-id="${params.templateId}">
    ${params.hero}
    <div class="content-body">
      ${params.introBlock}
      ${params.insightBlock}
      ${params.bulletPanel}
      ${params.quotePanel}
      ${params.bodyRemainder}
      ${params.ctaPanel}
      <div class="executive-signature">
        <div class="signature-name">${params.signatureName}</div>
        <div class="signature-title">${params.signatureTitle}</div>
      </div>
    </div>
    <div class="footer">
      <div class="footer-text">
        ${params.footerNote}<br><br>
        &copy; ${year} I Knowledge Factory. All rights reserved.<br>
        Innovation Hub | Pune | Mumbai
      </div>
    </div>
  </div>
</body>
</html>
`.trim();
}

export function wrapInEmailTemplate(
    templateId: EmailTemplateId | string | undefined,
    content: string,
    recipientName: string,
    options?: { isPreview?: boolean; templateSpec?: EmailTemplateSpec },
) {
    const logoSrc = "http://ikf-outreach.ikf.in/logo.png";
    const sections = extractSectionsFromBody(content || "");

    const disclaimer = `This communication contains proprietary insights curated by I Knowledge Factory Pvt. Ltd.. It is intended solely for ${recipientName || "the designated recipient"} and may not be distributed without authorization.`;

    // Built-in path (unchanged behavior)
    if (isEmailTemplateId(templateId)) {
        const activeTemplate = normalizeTemplateId(templateId);
        if (activeTemplate === "standard") {
            const safeContent = sanitizeEmailHtml(content || "");

            return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Standard Email</title>
  <style>
    body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:#f6f7fb}
    table{border-collapse:collapse}
    *{box-sizing:border-box}
    img{border:0;outline:none;text-decoration:none;display:block;max-width:100%;height:auto}
    a{color:#2563eb;text-decoration:underline}
    .email-body p{margin:0 0 12px}
    .email-body{font-family:"Segoe UI",Roboto,Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#0f172a;text-align:left}
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f7fb">
    <tr>
      <td align="center" style="padding:24px 12px">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 1px 3px rgba(15,23,42,.06)">
          <tr>
            <td style="padding:24px">
              <div class="email-body">
                ${safeContent}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
        }

        const signatureByTemplate: Record<EmailTemplateId, { name: string; title: string; pageTitle: string }> = {
            standard: { name: "I Knowledge Factory Pvt. Ltd.", title: "I Knowledge Factory Pvt. Ltd.", pageTitle: "Executive Briefing - I Knowledge Factory" },
            premium: { name: "Strategic Partnership Team", title: "I Knowledge Factory Pvt. Ltd.", pageTitle: "Executive Briefing - I Knowledge Factory" },
            modern: { name: "Growth Strategy Cell", title: "I Knowledge Factory Pvt. Ltd.", pageTitle: "Strategic Update - Bold Modern" },
            warm: { name: "Client Success Team", title: "I Knowledge Factory Pvt. Ltd.", pageTitle: "Relationship Update - Warm Storyline" },
            corporate: { name: "Business Advisory Desk", title: "I Knowledge Factory Pvt. Ltd.", pageTitle: "Corporate Briefing - IKF" },
            minimal: { name: "Strategic Desk", title: "I Knowledge Factory Pvt. Ltd.", pageTitle: "Business Communication - Minimal Rail" },
        };

        const signature = signatureByTemplate[activeTemplate];
        const safeTopic = sections.intro[0]?.replace(/<[^>]*>/g, "").slice(0, 80) || "Strategic outreach";

        return baseShell({
            title: signature.pageTitle,
            recipientName,
            styles: getTemplateStyles(activeTemplate),
            hero: renderHero(activeTemplate, logoSrc, recipientName),
            introBlock: renderIntroBlock(sections.intro.length ? sections.intro : [content]),
            insightBlock: renderInsightBlock(safeTopic, recipientName),
            bulletPanel: renderBulletPanel(sections.bullets),
            quotePanel: renderQuotePanel(sections.quotes),
            bodyRemainder: renderBodyRemainder(sections.remainder),
            ctaPanel: renderCtaPanel(),
            signatureName: signature.name,
            signatureTitle: signature.title,
            footerNote: disclaimer,
            templateId: activeTemplate,
        });
    }

    // Custom path: require templateSpec to be provided by the caller.
    const templateKey = templateId ? String(templateId) : "custom_unknown";
    const templateSpec = options?.templateSpec;
    if (!templateSpec) {
        // Defensive fallback: don't crash preview/dispatch.
        return baseShell({
            title: "Executive Briefing - I Knowledge Factory",
            recipientName,
            styles: getTemplateStyles("premium"),
            hero: renderHero("premium", logoSrc, recipientName),
            introBlock: renderIntroBlock(sections.intro.length ? sections.intro : [content]),
            insightBlock: renderInsightBlock("Strategic outreach", recipientName),
            bulletPanel: renderBulletPanel(sections.bullets),
            quotePanel: renderQuotePanel(sections.quotes),
            bodyRemainder: renderBodyRemainder(sections.remainder),
            ctaPanel: renderCtaPanel(),
            signatureName: "Strategic Partnership Team",
            signatureTitle: "I Knowledge Factory Pvt. Ltd.",
            footerNote: disclaimer,
            templateId: "premium",
        });
    }

    const sanitizeCssForCustom = (css: string) => {
        const raw = (css ?? "").toString();
        let cssOut = raw.replace(/@import\s+[^;]+;/gi, "");
        cssOut = cssOut.replace(/<\/?style\b[^>]*>/gi, "");
        cssOut = cssOut.replace(/url\(\s*['"]?\s*javascript:[^'")]+\s*['"]?\s*\)/gi, "url('#')");

        // Remove global selectors and modern layout that breaks in many email clients.
        cssOut = cssOut.replace(/(^|})\s*[^{}]*(\bhtml\b|\bbody\b|\*)[^{}]*\{[^}]*\}/gi, "$1");
        cssOut = cssOut.replace(/display\s*:\s*flex[^;]*;/gi, "");
        cssOut = cssOut.replace(/display\s*:\s*grid[^;]*;/gi, "");
        cssOut = cssOut.replace(/\bposition\s*:\s*[^;]*;/gi, "");
        cssOut = cssOut.replace(/\bz-index\s*:\s*[^;]*;/gi, "");

        return cssOut.trim();
    };

    const baseCustomCss = `
body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
.email-container{max-width:700px;margin:28px auto;overflow:hidden}
.hero{padding:28px 34px}
.hero-topline{font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;margin-bottom:16px}
.hero-table{border-collapse:collapse}
.hero-copy-cell{width:100%}
.hero-logo-cell{width:110px}
.hero-copy h1{margin:0 0 6px;font-size:26px;line-height:1.2}
.hero-copy p{margin:0;font-size:13px}
.logo{display:block;width:92px;max-width:92px;height:auto;max-height:none;border:0;outline:none;text-decoration:none}
.content-body{padding:28px 34px}
.content-body p{margin:0 0 14px}
.intro-block,.insight-block,.bullet-panel,.quote-panel,.body-remainder,.cta-panel{margin-bottom:18px}
.insight-block h3,.bullet-panel h3,.cta-panel h3{margin:0 0 8px;font-size:14px;letter-spacing:.04em;text-transform:uppercase}
.bullet-panel ul{margin:0;padding-left:18px}
.bullet-panel li{margin-bottom:7px}
.quote-panel blockquote{margin:0;padding:12px 14px}
.executive-signature{margin-top:18px;padding-top:14px}
.signature-name{font-size:18px;font-weight:700}
.signature-title{font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.footer{padding:18px 34px}
.footer-text{font-size:11px;line-height:1.6}
@media (max-width:600px){
  .email-container{margin:0;border:none}
  .hero,.content-body,.footer{padding:20px}
  .hero-logo-cell{width:84px}
  .logo{width:72px;max-width:72px}
}
`;

    // For custom templates we let the AI place {{logo}} explicitly (avoid logo duplication/alignment issues).
    const heroHtml = renderHero("premium", logoSrc, recipientName, { includeLogo: false }).replace(/hero--premium/g, "hero--custom");

    const safeTopic = sections.intro[0]?.replace(/<[^>]*>/g, "").slice(0, 80) || "Strategic outreach";

    const signatureHtml = `
<div class="executive-signature">
  <div class="signature-name">Strategic Desk</div>
  <div class="signature-title">I Knowledge Factory Pvt. Ltd.</div>
</div>`.trim();

    const footerHtml = `
<div class="footer">
  <div class="footer-text">
    ${disclaimer}<br><br>
    &copy; ${new Date().getFullYear()} I Knowledge Factory. All rights reserved.<br>
    Innovation Hub | Pune | Mumbai
  </div>
</div>`.trim();

    const logoHtml = `<img src="http://ikf-outreach.ikf.in/logo.png" alt="I Knowledge Factory Pvt. Ltd." class="logo" width="92">`;

    const replacements: Record<string, string> = {
        // Wrap modules into table cells to improve email-client compatibility.
        // (Even if layoutHtml uses divs, these tables reduce layout-breaking behaviors.)
        "{{hero}}": heroHtml,
        "{{intro}}": `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>${renderIntroBlock(sections.intro.length ? sections.intro : [content])}</td></tr></table>`,
        "{{insight}}": `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>${renderInsightBlock(safeTopic, recipientName)}</td></tr></table>`,
        "{{bullets}}": `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>${renderBulletPanel(sections.bullets)}</td></tr></table>`,
        "{{quotes}}": `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>${renderQuotePanel(sections.quotes)}</td></tr></table>`,
        "{{remainder}}": `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>${renderBodyRemainder(sections.remainder)}</td></tr></table>`,
        "{{cta}}": `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>${renderCtaPanel()}</td></tr></table>`,
        "{{signature}}": `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>${signatureHtml}</td></tr></table>`,
        "{{footer}}": `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>${footerHtml}</td></tr></table>`,
        "{{logo}}": logoHtml,
    };

    let injected = templateSpec.layoutHtml || "";
    for (const [needle, val] of Object.entries(replacements)) {
        injected = injected.split(needle).join(val);
    }

    // Keep custom templates email-safe.
    injected = sanitizeEmailHtml(injected).trim();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Custom Email Template - I Knowledge Factory</title>
  <style>
    ${baseCustomCss}
    ${sanitizeCssForCustom(templateSpec.styles)}
  </style>
</head>
<body>
  <div class="email-container" data-template-id="${templateKey}">
    ${injected}
  </div>
</body>
</html>
`.trim();
}

export function wrapInPremiumTemplate(content: string, recipientName: string, options?: { isPreview?: boolean }) {
    return wrapInEmailTemplate("premium", content, recipientName, options);
}
