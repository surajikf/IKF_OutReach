function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function looksLikeHtml(input: string) {
  // Heuristic: any tag-ish pattern
  return /<\s*\/?\s*[a-zA-Z][^>]*>/.test(input);
}

function plainTextToHtml(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "<p></p>";

  // Convert simple bullet lines into <ul><li> when possible
  const lines = normalized.split("\n");
  const bulletRegex = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/;

  const blocks: string[] = [];
  let currentPara: string[] = [];
  let currentList: string[] = [];

  const flushPara = () => {
    if (currentPara.length) {
      const p = currentPara.map(line => escapeHtml(line)).join("<br>").trim();
      if (p) blocks.push(`<p>${p}</p>`);
      currentPara = [];
    }
  };

  const flushList = () => {
    if (currentList.length) {
      blocks.push(`<ul>${currentList.map((li) => `<li>${escapeHtml(li)}</li>`).join("")}</ul>`);
      currentList = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      flushPara();
      continue;
    }

    const m = line.match(bulletRegex);
    if (m) {
      flushPara();
      currentList.push(m[2] || "");
      continue;
    }

    flushList();
    currentPara.push(line);
  }

  flushList();
  flushPara();

  return blocks.join("");
}

export function dedupeLeadingSalutation(html: string) {
  if (!html) return html;
  const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const match = html.match(/^\s*(<p\b[^>]*>[\s\S]*?<\/p>)\s*(<p\b[^>]*>[\s\S]*?<\/p>)([\s\S]*)$/i);
  if (!match) return html;
  const firstText = stripTags(match[1]).toLowerCase();
  const secondText = stripTags(match[2]).toLowerCase();
  if (firstText.startsWith("dear ") && secondText.startsWith("dear ")) {
    return `${match[1]}${match[3]}`;
  }
  return html;
}

/**
 * Normalizes email body content so it renders with global-standard spacing:
 * - Plain text becomes paragraphs / lists.
 * - Excess <br><br> becomes paragraph breaks.
 * - Ensures a block-level wrapper when needed.
 */
export function normalizeEmailBodyHtml(input: string) {
  const raw = (input ?? "").toString();
  const trimmed = raw.trim();
  if (!trimmed) return "<p></p>";

  // Strip common markdown code fences that sometimes sneak in
  const noFences = trimmed.replace(/```(?:html)?\s*|\s*```/g, "").trim();

  if (!looksLikeHtml(noFences)) {
    return plainTextToHtml(noFences);
  }

  // Work on HTML-ish content
  let html = noFences.replace(/\r\n/g, "\n");
  html = dedupeLeadingSalutation(html);

  // Normalize <br> variants
  html = html.replace(/<br\s*\/?>/gi, "<br>");

  // Convert multiple <br> into paragraph splits
  html = html.replace(/(?:<br>\s*){2,}/gi, "</p><p>");

  // If it starts with inline/text only, wrap in <p>
  const startsWithBlock = /^\s*<(p|h[1-6]|ul|ol|table|blockquote|div)\b/i.test(html);
  if (!startsWithBlock) {
    html = `<p>${html}</p>`;
  }

  // If we created paragraph splits but didn't have surrounding <p>, ensure it
  if (!/^\s*<p\b/i.test(html)) {
    html = `<p>${html}</p>`;
  }

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/gi, "");

  return dedupeLeadingSalutation(html.trim());
}

