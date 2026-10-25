// Legal documents and links of a market (LR-04, LR-06): which documents this portal
// serves, the links of its footer and sign-in notice, and the small Markdown subset
// the versioned documents in `legal/<market>/<version>/` are written in.
// Every market value comes from `marketLegal` (market-profile.mjs); nothing here
// compares markets. Portable: no framework, network or Node-only APIs.

/** The documents this portal serves, each at a fixed page. */
export const LEGAL_PAGES = Object.freeze({ privacy: "/privacy", terms: "/terms", offer: "/offer" });
/** A document version is also a folder name: lower case, digits, dots and dashes. */
export const LEGAL_VERSION = /^[0-9a-z][0-9a-z.-]{0,31}$/;
const STATUSES = new Set(["draft", "final"]);
const META_KEYS = new Set(["title", "version", "status", "effective", "review"]);

/**
 * @typedef {import('./market-profile.mjs').MarketLegal} MarketLegal
 * @typedef {"privacy" | "terms" | "offer"} LegalDocumentName
 */

/** The folder of the versioned documents, at the repository root. */
export const LEGAL_DIR = "legal";

/**
 * The path, inside `LEGAL_DIR`, of a document of the market's current version, or
 * null when the market has no such document (global, cn; or no version).
 * @param {string} market @param {MarketLegal} legal @param {LegalDocumentName} name
 */
export function legalDocumentFile(market, legal, name) {
  if (!Object.hasOwn(LEGAL_PAGES, name) || !legal[name] || !legal.version) return null;
  if (!/^[a-z]{2,8}$/.test(market) || !LEGAL_VERSION.test(legal.version) || legal.version.includes(".."))
    throw new Error("legal: invalid market or document version " + JSON.stringify(String(legal.version)));
  return market + "/" + legal.version + "/" + name + ".md";
}

/**
 * The public source tree of a release (`{version}` replaced), or, without a version,
 * the repository the template points into (the part before `/tree/`).
 * @param {MarketLegal} legal @param {string | null} [version]
 */
export function legalSourceUrl(legal, version = null) {
  if (!legal.source) return null;
  if (version) return /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/.test(version) ? legal.source.replaceAll("{version}", version) : null;
  const at = legal.source.indexOf("/tree/");
  return at > 0 ? legal.source.slice(0, at) : legal.source.replaceAll("{version}", "").replace(/\/+$/, "");
}

/**
 * The footer's legal and channel links, in order, without the ones the market does not
 * provide. Documents this portal serves link to its own page; the offer is shown only
 * with the Supporter feature (the one switch for Supporter links, LR-67/LR-68).
 * @param {MarketLegal} legal
 * @param {{supporter: boolean}} features
 * @returns {{key: "privacy" | "terms" | "offer" | "support" | "source" | "vk" | "telegram", href: string, external: boolean}[]}
 */
export function legalLinks(legal, features) {
  /** @type {{key: any, href: string, external: boolean}[]} */
  const links = [];
  if (legal.privacy) links.push({ key: "privacy", href: LEGAL_PAGES.privacy, external: false });
  if (legal.terms) links.push({ key: "terms", href: LEGAL_PAGES.terms, external: false });
  if (legal.offer && features.supporter) links.push({ key: "offer", href: LEGAL_PAGES.offer, external: false });
  if (legal.supportEmail) links.push({ key: "support", href: "mailto:" + legal.supportEmail, external: true });
  const source = legalSourceUrl(legal);
  if (source) links.push({ key: "source", href: source, external: true });
  if (legal.communityVk) links.push({ key: "vk", href: legal.communityVk, external: true });
  if (legal.communityTelegram) links.push({ key: "telegram", href: legal.communityTelegram, external: true });
  return links;
}

/**
 * The sign-in notice (login, /connect) needs both documents a player accepts.
 * @param {MarketLegal} legal
 */
export function signInNotice(legal) {
  return legal.terms && legal.privacy ? { terms: LEGAL_PAGES.terms, privacy: LEGAL_PAGES.privacy, version: legal.version } : null;
}

// --- Document format -------------------------------------------------------------
//
// Front matter between `---` lines (`key: value`): title, version, status (draft |
// final), effective (YYYY-MM-DD; empty for a draft) and an optional review line.
// Body: `## ` and `### ` headings, `- ` and `1. ` list items (one line each; a
// numbered list keeps its first number, so a list split by bullets continues), `> `
// notes, pipe tables and paragraphs (consecutive lines). Inline: **bold**, `code`,
// [text](https://… | mailto:… | /page) and {{placeholder}} for a value the owner
// still has to fill in. Anything else is an error, so a typo never ships silently.

/**
 * @typedef {{type: "text", value: string} | {type: "strong", children: Inline[]} | {type: "code", value: string}
 *   | {type: "link", href: string, children: Inline[]} | {type: "placeholder", value: string}} Inline
 * @typedef {{type: "h2" | "h3" | "p" | "note", id?: string, inline: Inline[]} | {type: "ul", items: Inline[][]}
 *   | {type: "ol", start: number, items: Inline[][]}
 *   | {type: "table", head: Inline[][], rows: Inline[][][]}} Block
 * @typedef {{title: string, version: string, status: "draft" | "final", effective: string | null, review: string | null}} LegalMeta
 */

/** @param {string} href */
function safeHref(href) {
  if (/^https:\/\/[^\s/]+(\/\S*)?$/.test(href)) return href;
  if (/^mailto:[^\s@/]+@[^\s@/]+$/.test(href)) return href;
  if (/^\/(?!\/)[A-Za-z0-9/_#?=&.-]*$/.test(href)) return href;
  throw new Error("legal: link target not allowed: " + JSON.stringify(href));
}

const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\{\{(.+?)\}\}/g;

/**
 * @param {string} text
 * @param {boolean} [nested] inside bold or a link: no further bold or links
 * @returns {Inline[]}
 */
export function parseInline(text, nested = false) {
  /** @type {Inline[]} */
  const out = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const at = /** @type {number} */ (match.index);
    if (at > last) out.push({ type: "text", value: text.slice(last, at) });
    if (match[1] !== undefined) {
      if (nested) throw new Error("legal: nested emphasis in " + JSON.stringify(text));
      out.push({ type: "strong", children: parseInline(match[1], true) });
    } else if (match[2] !== undefined) out.push({ type: "code", value: match[2] });
    else if (match[3] !== undefined) {
      if (nested) throw new Error("legal: nested link in " + JSON.stringify(text));
      out.push({ type: "link", href: safeHref(match[4]), children: parseInline(match[3], true) });
    } else out.push({ type: "placeholder", value: match[5].trim() });
    last = at + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  for (const part of out)
    if (part.type === "text" && /\*\*|\{\{|\}\}|\]\(/.test(part.value))
      throw new Error("legal: unbalanced markup in " + JSON.stringify(text));
  return out;
}

/** @param {string} line */
function cells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) throw new Error("legal: a table row must start and end with |: " + JSON.stringify(line));
  return trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
}

/** Heading anchors: the explicit `{#id}` suffix, else none. @param {string} text */
function heading(text) {
  const match = /^(.*?)\s*\{#([a-z0-9-]{1,40})\}$/.exec(text);
  return match ? { id: match[2], text: match[1] } : { id: undefined, text };
}

/**
 * Parses one legal document. Throws on any unknown syntax or missing metadata.
 * @param {string} source
 * @returns {{meta: LegalMeta, blocks: Block[]}}
 */
export function parseLegalDocument(source) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  if (lines[0] !== "---") throw new Error("legal: the document must start with front matter (---)");
  const end = lines.indexOf("---", 1);
  if (end < 0) throw new Error("legal: front matter is not closed");
  /** @type {Record<string, string>} */
  const raw = {};
  for (const line of lines.slice(1, end)) {
    const match = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!match || !META_KEYS.has(match[1]) || Object.hasOwn(raw, match[1])) throw new Error("legal: bad front matter line " + JSON.stringify(line));
    raw[match[1]] = match[2].trim();
  }
  if (!raw.title) throw new Error("legal: title missing");
  if (!raw.version || !LEGAL_VERSION.test(raw.version)) throw new Error("legal: version missing or invalid");
  if (!STATUSES.has(raw.status)) throw new Error('legal: status must be "draft" or "final"');
  const effective = raw.effective || null;
  if (effective !== null && !/^\d{4}-\d{2}-\d{2}$/.test(effective)) throw new Error("legal: effective must be YYYY-MM-DD");
  if (raw.status === "final" && !effective) throw new Error("legal: a final document needs its effective date");
  if (raw.status === "draft" && effective) throw new Error("legal: a draft has no effective date");
  /** @type {LegalMeta} */
  const meta = { title: raw.title, version: raw.version, status: /** @type {"draft" | "final"} */ (raw.status), effective, review: raw.review || null };

  /** @type {Block[]} */
  const blocks = [];
  /** @type {string[]} */
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "p", inline: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const body = lines.slice(end + 1);
  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    if (!line.trim()) { flush(); continue; }
    if (/^#{1}\s|^#{4,}/.test(line)) throw new Error("legal: only ## and ### headings are allowed: " + JSON.stringify(line));
    let match;
    if ((match = /^(##|###) (.+)$/.exec(line))) {
      flush();
      const { id, text } = heading(match[2].trim());
      blocks.push({ type: match[1] === "##" ? "h2" : "h3", ...(id ? { id } : {}), inline: parseInline(text) });
    } else if ((match = /^- (.+)$/.exec(line)) || (match = /^(\d{1,2})\. (.+)$/.exec(line))) {
      flush();
      const type = line.startsWith("- ") ? "ul" : "ol";
      const previous = blocks.at(-1);
      const item = parseInline((match[2] ?? match[1]).trim());
      if (previous && previous.type === type && body[i - 1]?.trim()) previous.items.push(item);
      else blocks.push(type === "ul" ? { type, items: [item] } : { type, start: Number(match[1]), items: [item] });
    } else if ((match = /^> (.+)$/.exec(line))) {
      flush();
      blocks.push({ type: "note", inline: parseInline(match[1].trim()) });
    } else if (line.trimStart().startsWith("|")) {
      flush();
      const head = cells(line);
      const separator = body[i + 1] === undefined ? [] : cells(body[i + 1]);
      if (separator.length !== head.length || !separator.every((cell) => /^:?-{3,}:?$/.test(cell))) throw new Error("legal: a table needs a |---| separator row");
      /** @type {Inline[][][]} */
      const rows = [];
      i += 2;
      while (i < body.length && body[i].trimStart().startsWith("|")) {
        const row = cells(body[i]);
        if (row.length !== head.length) throw new Error("legal: table row has " + row.length + " cells, expected " + head.length);
        rows.push(row.map((cell) => parseInline(cell)));
        i++;
      }
      i--;
      blocks.push({ type: "table", head: head.map((cell) => parseInline(cell)), rows });
    } else if (/^\s/.test(line)) throw new Error("legal: indented lines are not supported: " + JSON.stringify(line));
    else paragraph.push(line.trim());
  }
  flush();
  return { meta, blocks };
}

/**
 * The plain text of a parsed document (tests and search): headings, paragraphs,
 * list items and table cells, placeholders as `{{…}}`.
 * @param {{blocks: Block[]}} document
 */
export function legalPlainText(document) {
  /** @param {Inline[]} inline @returns {string} */
  const text = (inline) => inline.map((part) => part.type === "text" || part.type === "code" ? part.value
    : part.type === "placeholder" ? "{{" + part.value + "}}" : text(part.children)).join("");
  return document.blocks.map((block) => block.type === "ul" || block.type === "ol" ? block.items.map(text).join("\n")
    : block.type === "table" ? [block.head, ...block.rows].map((row) => row.map(text).join(" | ")).join("\n")
    : text(block.inline)).join("\n");
}
