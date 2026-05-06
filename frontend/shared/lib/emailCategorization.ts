export type EmailCategory = 
  | "General / Communication"
  | "System / Automated"
  | "HR / Careers"
  | "Sales / Business"
  | "Technical / IT"
  | "Billing / Accounts"
  | "Customer Service"
  | "Misc / Other";

const CATEGORY_MAP: Record<string, EmailCategory> = {
  // General / Communication
  "info": "General / Communication",
  "contact": "General / Communication",
  "support": "General / Communication",
  "help": "General / Communication",
  "enquiry": "General / Communication",
  "inquiries": "General / Communication",
  "hello": "General / Communication",
  "connect": "General / Communication",

  // System / Automated
  "noreply": "System / Automated",
  "donotreply": "System / Automated",
  "no-reply": "System / Automated",
  "notification": "System / Automated",
  "alerts": "System / Automated",
  "updates": "System / Automated",
  "system": "System / Automated",

  // HR / Careers
  "career": "HR / Careers",
  "careers": "HR / Careers",
  "jobs": "HR / Careers",
  "hr": "HR / Careers",
  "recruitment": "HR / Careers",
  "hiring": "HR / Careers",
  "talent": "HR / Careers",

  // Sales / Business
  "sales": "Sales / Business",
  "business": "Sales / Business",
  "partnerships": "Sales / Business",
  "partner": "Sales / Business",
  "marketing": "Sales / Business",
  "promotions": "Sales / Business",

  // Technical / IT
  "admin": "Technical / IT",
  "webmaster": "Technical / IT",
  "tech": "Technical / IT",
  "it": "Technical / IT",
  "security": "Technical / IT",
  "abuse": "Technical / IT",

  // Billing / Accounts
  "accounts": "Billing / Accounts",
  "billing": "Billing / Accounts",
  "payments": "Billing / Accounts",
  "invoice": "Billing / Accounts",
  "finance": "Billing / Accounts",
  "amc": "Billing / Accounts",

  // Customer Service
  "service": "Customer Service",
  "customerservice": "Customer Service",
  "care": "Customer Service",
  "customercare": "Customer Service",
  "feedback": "Customer Service",

  // Misc / Other
  "junk": "Misc / Other",
  "test": "Misc / Other",
  "demo": "Misc / Other",
  "office": "Misc / Other",
  "team": "Misc / Other",
};

export function categorizeEmail(email: string): EmailCategory {
  if (!email) return "General / Communication";
  
  const prefix = email.split("@")[0].toLowerCase();
  
  // Check direct matches
  if (CATEGORY_MAP[prefix]) {
    return CATEGORY_MAP[prefix];
  }
  
  // Check for common variations or substrings (optional, but good for robustness)
  // For now, let's stick to the user's specific list
  
  return "General / Communication";
}

export const CATEGORIES: EmailCategory[] = [
  "General / Communication",
  "System / Automated",
  "HR / Careers",
  "Sales / Business",
  "Technical / IT",
  "Billing / Accounts",
  "Customer Service",
  "Misc / Other"
];

export const CATEGORY_COLORS: Record<EmailCategory, string> = {
  "General / Communication": "bg-blue-50 text-blue-600 border-blue-100",
  "System / Automated": "bg-slate-50 text-slate-600 border-slate-200",
  "HR / Careers": "bg-purple-50 text-purple-600 border-purple-100",
  "Sales / Business": "bg-emerald-50 text-emerald-600 border-emerald-100",
  "Technical / IT": "bg-indigo-50 text-indigo-600 border-indigo-100",
  "Billing / Accounts": "bg-amber-50 text-amber-600 border-amber-100",
  "Customer Service": "bg-cyan-50 text-cyan-600 border-cyan-100",
  "Misc / Other": "bg-rose-50 text-rose-600 border-rose-100",
};
