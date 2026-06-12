import type { AgencyLead } from "@/types";

const HUBSPOT_BASE = "https://api.hubapi.com";

interface HubspotErrorBody {
  message?: string;
}

async function hubspotRequest<T>(path: string, init: RequestInit): Promise<T> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    throw new Error("HUBSPOT_ACCESS_TOKEN is not configured");
  }

  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as HubspotErrorBody;
    throw new Error(body.message ?? `HubSpot API returned HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface HubspotObject {
  id: string;
}

/**
 * Pushes an agency lead to HubSpot as a Company (keyed by domain) with a Note
 * summarising the AI-identified flaws and the generated cold email draft.
 */
export async function exportLeadToHubspot(lead: AgencyLead): Promise<{ companyId: string; noteId: string }> {
  const domain = hostname(lead.url);
  const name   = lead.companyName ?? domain;

  // 1. Find an existing company by domain, or create a new one
  const search = await hubspotRequest<{ results: HubspotObject[] }>("/crm/v3/objects/companies/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: domain }] }],
      limit: 1,
    }),
  });

  const company = search.results[0]
    ?? await hubspotRequest<HubspotObject>("/crm/v3/objects/companies", {
      method: "POST",
      body: JSON.stringify({ properties: { name, domain } }),
    });

  // 2. Create a note summarising the audit + cold email draft
  const flawsList = lead.identifiedFlaws
    .map((f) => `- ${f.title}: ${f.description}`)
    .join("\n");

  const noteBody =
    `<p><strong>SierraLogic Lead — ${lead.url}</strong></p>` +
    `<p><strong>Identified flaws:</strong></p><pre>${flawsList}</pre>` +
    `<p><strong>Cold email draft:</strong></p><pre>${lead.coldEmailDraft}</pre>`;

  const note = await hubspotRequest<HubspotObject>("/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_note_body:   noteBody,
        hs_timestamp:   new Date().toISOString(),
      },
      associations: [{
        to:   { id: company.id },
        types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 190 }], // note -> company
      }],
    }),
  });

  return { companyId: company.id, noteId: note.id };
}
