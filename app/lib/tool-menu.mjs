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
];
