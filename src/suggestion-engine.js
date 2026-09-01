import bundle from "../data/suggestions-v10.json" with { type: "json" };
import { assessInquirySafety, SAFETY_DRAFT } from "./inquiry-safety.js";

const STOP_WORDS = new Set(["cho", "minh", "mình", "cua", "của", "vay", "vậy", "nha", "nhé", "voi", "với", "truong", "trường", "be", "bé", "em", "anh", "chi", "chị", "ba", "me", "mẹ", "duoc", "được", "khong", "không", "mot", "một", "la", "là", "the", "thế"]);

function normalize(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function score(textTokens, suggestion) {
  const corpus = normalize(`${suggestion.intent} ${suggestion.customer_question} ${suggestion.follow_up_questions}`);
  const matches = textTokens.filter((token) => corpus.includes(token)).length;
  const intent = normalize(suggestion.intent).join(" ");
  const text = textTokens.join(" ");
  const boosts = [
    ["hoc phi", ["phi", "hocphi", "gia", "chi phi"]], ["hoc thu", ["hoc", "thu"]], ["tham quan", ["tham", "quan", "ghe"]],
    ["do tuoi", ["thang", "tuoi", "nhan"]], ["gio hoc", ["gio", "don", "tra", "thu bay"]], ["lan dau", ["lan", "dau", "khoc", "bam"]],
  ];
  let extra = 0;
  for (const [label, keys] of boosts) if (intent.includes(label) && keys.some((key) => text.includes(key))) extra += 3;
  // TH-* are the reviewed, evidence-backed cross-channel scripts. Prefer them
  // over forecast-only variants whenever the customer's wording actually matches.
  const evidenceBoost = suggestion.id.startsWith("TH-") && matches > 0 ? 10 : 0;
  return matches + extra + evidenceBoost;
}

export function suggest(text, { limit = 3 } = {}) {
  if (typeof text !== "string" || text.trim().length === 0) throw new Error("text is required");
  if (text.length > 4000) throw new Error("text exceeds 4000 characters");
  const safety = assessInquirySafety(text);
  if (safety.classification !== "standard") {
    return {
      version: bundle.version,
      outbound_sending: false,
      requires_human_approval: true,
      inquiry_safety: safety,
      suggestions: [SAFETY_DRAFT],
    };
  }
  const tokens = normalize(text);
  const ranked = bundle.suggestions.map((item) => ({ ...item, score: score(tokens, item) })).sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
  return {
    version: bundle.version,
    outbound_sending: false,
    requires_human_approval: true,
    inquiry_safety: safety,
    suggestions: ranked.slice(0, Math.min(Math.max(Number(limit) || 3, 1), 3)).map(({ score: _score, ...item }) => item),
  };
}

export const libraryMeta = Object.freeze({ version: bundle.version, count: bundle.count, outbound_sending: bundle.outbound_sending });
