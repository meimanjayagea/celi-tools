export const TOOL_MENU_GROUPS = [
  {
    title: "Format & validate",
    items: [
      { id: "format", label: "Format JSON", description: "Beautify and indent your data" },
      { id: "validate", label: "Validate JSON", description: "Check syntax and line errors" },
      { id: "fix", label: "Fix JSON", description: "Repair common formatting mistakes" },
      { id: "clean", label: "Clean JSON", description: "Remove empty values" },
    ],
  },
  {
    title: "Explore",
    items: [
      { id: "tree", label: "Tree view", description: "Browse nested keys and values" },
      { id: "graph", label: "Graph view", description: "See objects as connected nodes" },
      { id: "json", label: "JSON source", description: "Read the formatted source" },
    ],
  },
  {
    title: "Convert",
    items: [
      { id: "xml", label: "JSON to XML", description: "Export as an XML document" },
      { id: "csv", label: "JSON to CSV", description: "Export rows as a CSV file" },
      { id: "yaml", label: "JSON to YAML", description: "Export as YAML" },
    ],
  },
  {
    title: "Files",
    items: [
      { id: "upload", label: "Upload JSON", description: "Open a local .json or .txt file" },
      { id: "download", label: "Download formatted JSON", description: "Save the current JSON file" },
      { id: "print", label: "Print JSON", description: "Open a print-ready view" },
    ],
  },
  {
    title: "Preferences",
    items: [
      { id: "indent", label: "Indentation", description: "Choose 2, 3, or 4 spaces" },
      { id: "auto-update", label: "Auto update", description: "Refresh the preview as you type" },
    ],
  },
  {
    title: "Encrypt & Decrypt",
    items: [
      { id: "base64-encode", label: "Base64 Encode", description: "Encode text to Base64" },
      { id: "base64-decode", label: "Base64 Decode", description: "Decode Base64 to text" },
      { id: "md5", label: "MD5 Hash", description: "Generate MD5 hash" },
      { id: "sha1", label: "SHA-1 Hash", description: "Generate SHA-1 hash" },
      { id: "sha256", label: "SHA-256 Hash", description: "Generate SHA-256 hash" },
      { id: "sha512", label: "SHA-512 Hash", description: "Generate SHA-512 hash" },
      { id: "aes-encrypt", label: "AES Encrypt", description: "Encrypt text with AES-GCM" },
      { id: "aes-decrypt", label: "AES Decrypt", description: "Decrypt AES-GCM ciphertext" },
      { id: "rot13", label: "ROT13", description: "Rotate text by 13 characters" },
      { id: "caesar", label: "Caesar Cipher", description: "Shift text by custom amount" },
      { id: "url-encode", label: "URL Encode", description: "Encode text for URLs" },
      { id: "url-decode", label: "URL Decode", description: "Decode URL-encoded text" },
      { id: "binary", label: "Binary Converter", description: "Text to binary and back" },
      { id: "hex", label: "Hex Converter", description: "Text to hex and back" },
    ],
  },
];
