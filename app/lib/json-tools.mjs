export function formatJson(text, spaces = 2) {
  const value = JSON.parse(text);
  return JSON.stringify(value, null, [2, 3, 4].includes(spaces) ? spaces : 2);
}

function quoteSingleQuotedStrings(text) {
  let output = "";
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char !== "'" && char !== '"') {
      output += char;
      index += 1;
      continue;
    }

    const quote = char;
    let value = "";
    index += 1;
    while (index < text.length && text[index] !== quote) {
      if (text[index] === "\\" && index + 1 < text.length) {
        const next = text[index + 1];
        if (quote === "'" && next === "'") {
          value += "'";
          index += 2;
          continue;
        }
        if (quote === "'" && next === '"') {
          value += '"';
          index += 2;
          continue;
        }
        value += text[index] + next;
        index += 2;
        continue;
      }
      value += text[index];
      index += 1;
    }
    if (index >= text.length) throw new SyntaxError("Unterminated string literal");
    index += 1;
    output += JSON.stringify(value);
  }
  return output;
}

function quoteBareKeys(text) {
  let output = "";
  let index = 0;
  let previous = "";
  while (index < text.length) {
    const char = text[index];
    if (char === '"') {
      let value = char;
      index += 1;
      while (index < text.length) {
        value += text[index];
        if (text[index] === "\\" && index + 1 < text.length) {
          value += text[index + 1];
          index += 2;
          continue;
        }
        if (text[index] === '"') {
          index += 1;
          break;
        }
        index += 1;
      }
      output += value;
      previous = '"';
      continue;
    }

    if (/[A-Za-z_$]/.test(char) && (previous === "{" || previous === ",")) {
      let end = index + 1;
      while (end < text.length && /[\w$-]/.test(text[end])) end += 1;
      let lookahead = end;
      while (/\s/.test(text[lookahead] || "")) lookahead += 1;
      if (text[lookahead] === ":") {
        const key = text.slice(index, end);
        output += JSON.stringify(key);
        index = end;
        previous = "key";
        continue;
      }
    }

    output += char;
    if (!/\s/.test(char)) previous = char;
    index += 1;
  }
  return output;
}

function stripTrailingCommas(text) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === ",") {
      let next = index + 1;
      while (/\s/.test(text[next] || "")) next += 1;
      if (text[next] === "}" || text[next] === "]") continue;
    }
    output += char;
  }
  return output;
}

export function fixJson(text, spaces = 2) {
  let candidate = quoteSingleQuotedStrings(text);
  candidate = quoteBareKeys(candidate);
  candidate = stripTrailingCommas(candidate);
  return JSON.stringify(JSON.parse(candidate), null, [2, 3, 4].includes(spaces) ? spaces : 2);
}

function xmlName(value) {
  const name = String(value).replace(/[^\w.-]/g, "_");
  return /^[A-Za-z_]/.test(name) ? name : `_${name}`;
}

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function xmlNode(name, value, depth) {
  const indent = "  ".repeat(depth);
  const tag = xmlName(name);
  if (Array.isArray(value)) {
    if (!value.length) return `${indent}<${tag}></${tag}>`;
    return `${indent}<${tag}>\n${value.map((item) => xmlNode("item", item, depth + 1)).join("\n")}\n${indent}</${tag}>`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return `${indent}<${tag}></${tag}>`;
    return `${indent}<${tag}>\n${entries.map(([key, item]) => xmlNode(key, item, depth + 1)).join("\n")}\n${indent}</${tag}>`;
  }
  return `${indent}<${tag}>${value === null ? "" : xmlEscape(value)}</${tag}>`;
}

export function toXml(value) {
  return xmlNode("root", value, 0);
}

function csvCell(value) {
  const text = value !== null && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(value) {
  const rows = Array.isArray(value) ? value : [value];
  if (!rows.length) return "";
  const objects = rows.filter((row) => row !== null && typeof row === "object" && !Array.isArray(row));
  if (!objects.length) return ["value", ...rows.map(csvCell)].join("\n");
  const headers = [...new Set(objects.flatMap((row) => Object.keys(row)))];
  return [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((key) => csvCell(row?.[key])).join(","))].join("\n");
}

export function cleanJson(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== "").map(cleanJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== null && item !== "")
      .map(([key, item]) => [key, cleanJson(item)])
      .filter(([, item]) => !(item && typeof item === "object" && !Array.isArray(item) && Object.keys(item).length === 0)));
  }
  return value;
}
