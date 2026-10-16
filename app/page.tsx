import type { Metadata } from "next";
import JsonWorkbench from "./components/json-workbench";

export const metadata: Metadata = {
  title: "JSON Formatter & Validator — Celi Tools",
  description: "Format, validate, explore and convert JSON in your browser. Your data stays on your device.",
};

export default function Home() {
  return <JsonWorkbench />;
}
