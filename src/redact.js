// Shared redaction used before any customer message text is persisted
// (Lark Base) or logged. Never log/store raw phone/email/long digit runs.
export function redact(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email đã ẩn]")
    .replace(/(?:\+?84|0)(?:[\s.-]?\d){8,10}/g, "[số điện thoại đã ẩn]")
    .replace(/\b\d{9,16}\b/g, "[dãy số đã ẩn]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}
