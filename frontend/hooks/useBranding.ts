import { useState, useEffect } from "react";
import { apiPath } from "@/frontend/lib/app-path";

export interface Branding {
  projectName: string;
  projectLogo: string;
}

const DEFAULT_BRANDING: Branding = {
  projectName: "IKF Outreach",
  projectLogo: ""
};

export function useBranding() {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBranding() {
      try {
        const res = await fetch(apiPath("/settings"));
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok || !contentType.includes("application/json")) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Settings request failed (${res.status})`);
        }
        const result = await res.json();
        if (result.success) {
          setBranding({
            projectName: result.data.projectName || DEFAULT_BRANDING.projectName,
            projectLogo: result.data.projectLogo || ""
          });
        }
      } catch (err) {
        console.error("Failed to fetch branding settings:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchBranding();
  }, []);

  return { ...branding, loading };
}
