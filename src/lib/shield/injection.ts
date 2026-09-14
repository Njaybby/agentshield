import type { GateCheck, ProvenanceSource } from "./types";

/** Classic jailbreak / instruction-override phrases. */
const INJECTION_PHRASES = [
  /ignore (all |any )?(previous|prior|above) (instructions|rules|prompts)/i,
  /disregard (your|the) (system|safety|policy)/i,
  /you are now (unrestricted|jailbroken|DAN)/i,
  /override (safety|policy|guardrails?)/i,
  /do not (follow|obey) (your )?(system|developer)/i,
  /exfiltrat(e|ion)|leak (the )?(seed|private key|mnemonic)/i,
  /transfer (all|entire) (funds|balance) to/i,
  /approve\(.*(max|unlimited|type\(uint256\)\.max)/i,
  /\[\s*SYSTEM\s*\]|<<\s*SYS\s*>>|<\|im_start\|>/i,
  /developer mode (enabled|on)/i,
];

/** Morse-code payload patterns (spaces/slashes of dots+dashes). */
const MORSE_RE =
  /(?:^|[\s([{])([.\-\/]{1,6}(?:\s+[.\-\/]{1,6}){4,})(?:$|[\s)\]}.,;:!?\n])/m;

/** Homoglyph / zero-width steganography. */
const STEGO_RE =
  /[\u200b\u200c\u200d\ufeff\u2060]|[\u0400-\u04FF].*[a-zA-Z]|[аеорсухАЕОРСУХ]{2,}/;

const ROLE_FLIP_RE =
  /as (an? )?(admin|root|owner|god mode)|pretend you (are|have) no (limits|restrictions)/i;

function decodeMorse(chunk: string): string {
  const map: Record<string, string> = {
    ".-": "A",
    "-...": "B",
    "-.-.": "C",
    "-..": "D",
    ".": "E",
    "..-.": "F",
    "--.": "G",
    "....": "H",
    "..": "I",
    ".---": "J",
    "-.-": "K",
    ".-..": "L",
    "--": "M",
    "-.": "N",
    "---": "O",
    ".--.": "P",
    "--.-": "Q",
    ".-.": "R",
    "...": "S",
    "-": "T",
    "..-": "U",
    "...-": "V",
    ".--": "W",
    "-..-": "X",
    "-.--": "Y",
    "--..": "Z",
    "-----": "0",
    ".----": "1",
    "..---": "2",
    "...--": "3",
    "....-": "4",
    ".....": "5",
    "-....": "6",
    "--...": "7",
    "---..": "8",
    "----.": "9",
  };
  return chunk
    .trim()
    .split(/\s+/)
    .map((t) => {
      if (t === "/") return " ";
      return map[t] ?? "?";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function scanProvenanceForInjection(
  sources: ProvenanceSource[],
  userIntent: string,
): GateCheck[] {
  const checks: GateCheck[] = [];
  const corpus = [
    { label: "user_intent", content: userIntent },
    ...sources.map((s, i) => ({
      label: `${s.type}:${i}${s.url ? `@${s.url}` : ""}`,
      content: s.content,
    })),
  ];

  for (const item of corpus) {
    for (const re of INJECTION_PHRASES) {
      if (re.test(item.content)) {
        checks.push({
          id: "S1_PROMPT_INJECTION",
          name: "Prompt-injection phrase",
          passed: false,
          severity: "critical",
          detail: `Matched ${re} in ${item.label}`,
        });
      }
    }

    const morse = item.content.match(MORSE_RE);
    if (morse) {
      const decoded = decodeMorse(morse[1]);
      const hostile =
        /TRANSFER|DRAIN|IGNORE|APPROVE|SEED|PRIVATE|WALLET|SENDALL|HIJACK/.test(
          decoded,
        );
      checks.push({
        id: "S1_MORSE_STEGANOGRAPHY",
        name: "Morse steganography",
        passed: !hostile,
        severity: hostile ? "critical" : "medium",
        detail: hostile
          ? `Decoded Morse in ${item.label}: "${decoded}" — hostile payload`
          : `Morse-like pattern in ${item.label}: "${decoded}"`,
      });
    }

    if (STEGO_RE.test(item.content)) {
      checks.push({
        id: "S1_HOMOGLYPH_STEGO",
        name: "Homoglyph / zero-width stego",
        passed: false,
        severity: "high",
        detail: `Steganographic characters detected in ${item.label}`,
      });
    }

    if (ROLE_FLIP_RE.test(item.content) && item.label !== "user_intent") {
      checks.push({
        id: "S1_ROLE_FLIP",
        name: "Role-flip in untrusted source",
        passed: false,
        severity: "high",
        detail: `Untrusted source ${item.label} attempts role override`,
      });
    }
  }

  if (checks.length === 0) {
    checks.push({
      id: "S1_CLEAN",
      name: "Injection surface clean",
      passed: true,
      severity: "info",
      detail: "No injection / stego signatures in provenance chain",
    });
  }

  return checks;
}
