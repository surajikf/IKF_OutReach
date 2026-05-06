/**
 * Lightweight email HTML sanitizer.
 * Email bodies are user/AI-provided HTML; we strip the most dangerous constructs
 * without adding heavy dependencies.
 */
export function sanitizeEmailHtml(input: string) {
  let html = (input ?? "").toString();

  // Remove script tags entirely
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove inline event handlers like onclick="..."
  html = html.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  html = html.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");

  // Neutralize javascript: URLs in href/src
  html = html.replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, ' $1="#"');
  html = html.replace(/\s(href|src)\s*=\s*javascript:[^\s>]+/gi, ' $1="#"');

  // Remove any leaked branded/legal/sign-off text (keeps emails generic & client-ready).
  html = html.replace(/Senior\s+Advisor\s+at\s+(?:I\s*Knowledge\s*Factory|IKF)/gi, "Senior Advisor");
  html = html.replace(/\bI\s*Knowledge\s*Factory\b/gi, "");
  html = html.replace(/\bIKF\b/gi, "");

  // Drop whole disclaimer paragraphs/div blocks if present.
  html = html.replace(/<p\b[^>]*>[\s\S]*?This\s+communication\s+contains\s+proprietary\s+insights[\s\S]*?<\/p>/gi, "");
  html = html.replace(/<div\b[^>]*>[\s\S]*?This\s+communication\s+contains\s+proprietary\s+insights[\s\S]*?<\/div>/gi, "");

  // Remove brand-tagged sign-off blocks.
  html = html.replace(/<p\b[^>]*>[\s\S]*?(?:I\s*Knowledge\s*Factory|IKF)[\s\S]*?<\/p>/gi, "");
  html = html.replace(/<div\b[^>]*>[\s\S]*?(?:I\s*Knowledge\s*Factory|IKF)[\s\S]*?<\/div>/gi, "");

  // Remove AI/system fallback banners that should never reach the emailer.
  html = html.replace(/<p\b[^>]*>[\s\S]*?AI\s*Synthesized\s*Failed[\s\S]*?<\/p>/gi, "");
  html = html.replace(/<p\b[^>]*>[\s\S]*?Template\s*Fallback[\s\S]*?<\/p>/gi, "");
  html = html.replace(/<div\b[^>]*>[\s\S]*?AI\s*Synthesized\s*Failed[\s\S]*?<\/div>/gi, "");
  html = html.replace(/<div\b[^>]*>[\s\S]*?Template\s*Fallback[\s\S]*?<\/div>/gi, "");
  html = html.replace(/AI\s*Synthesized\s*Failed\s*-\s*Template\s*Fallback/gi, "");
  html = html.replace(/Template\s*Fallback/gi, "");

  // Remove common meta/instruction phrases if they leak into the body.
  html = html.replace(/\bYour task is\b/gi, "");
  html = html.replace(/\bYou have been provided with\b/gi, "");
  html = html.replace(/\bIn summary\b/gi, "");
  html = html.replace(/\bAdditionally\b/gi, "");
  html = html.replace(/\bFurthermore\b/gi, "");
  html = html.replace(/\bIt is important to note\b/gi, "");
  html = html.replace(/\bWe will\b/gi, " ");
  html = html.replace(/\bWe can\b/gi, " ");

  // Remove template-team sign-offs that can leak into the message body.
  const teamNames = [
    "Strategic Partnership Team",
    "Growth Strategy Cell",
    "Client Success Team",
    "Business Advisory Desk",
    "Strategic Desk",
    "Strategic Partnership Team",
  ];
  for (const name of teamNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Remove whole blocks that contain the sign-off name.
    html = html.replace(new RegExp(`<p\\b[^>]*>[\\s\\S]*?${escaped}[\\s\\S]*?<\\/p>`, "gi"), "");
    html = html.replace(new RegExp(`<div\\b[^>]*>[\\s\\S]*?${escaped}[\\s\\S]*?<\\/div>`, "gi"), "");
    // Also remove any remaining plain occurrences.
    html = html.replace(new RegExp(escaped, "gi"), "");
  }

  // Compress excessive whitespace introduced by removals.
  html = html.replace(/\s{2,}/g, " ");

  return html.trim();
}

