/**
 * Builds an OpenAI fine-tuning JSONL dataset from cold-email drafts that
 * users rated "good" (optionally edited) via the Agency lead feedback widget.
 *
 * Usage: npm run finetune:export
 * Output: finetune-dataset.jsonl (one fine-tuning example per line)
 */
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { AGENCY_LEAD_SYSTEM_PROMPT } from "@/lib/prompts/agency";
import type { LeadFlaw } from "@/types";

// Load DATABASE_URL etc. from .env.local since this script runs outside Next's runtime
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1");
  }
}

loadEnvLocal();

async function main() {
  const feedback = await prisma.emailFeedback.findMany({
    where: { rating: "good" },
    orderBy: { createdAt: "asc" },
  });

  const leadIds = feedback.map((f) => f.leadId).filter((id): id is string => !!id);
  const leads = await prisma.lead.findMany({ where: { id: { in: leadIds } } });
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const lines: string[] = [];
  for (const f of feedback) {
    const lead = f.leadId ? leadById.get(f.leadId) : undefined;
    const coldEmailDraft = f.editedDraft ?? f.emailDraft;

    const assistantContent = JSON.stringify({
      companyName:     lead?.companyName ?? null,
      identifiedFlaws: (lead?.identifiedFlaws as unknown as LeadFlaw[]) ?? [],
      coldEmailDraft,
    });

    lines.push(JSON.stringify({
      messages: [
        { role: "system", content: AGENCY_LEAD_SYSTEM_PROMPT },
        { role: "user", content: `Website URL: ${f.url}` },
        { role: "assistant", content: assistantContent },
      ],
    }));
  }

  const outPath = path.resolve(process.cwd(), "finetune-dataset.jsonl");
  fs.writeFileSync(outPath, lines.join("\n") + (lines.length ? "\n" : ""));
  console.log(`Wrote ${lines.length} examples to ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
