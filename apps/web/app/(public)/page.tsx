import type { Metadata } from "next";
import LandingPage from "../components/landing-page";
export const metadata: Metadata = {
    title: "Celi Tools — Konversi file, kompres, dan olah data",
    description: "Konversi dan kompres file, rapikan JSON, serta olah teks dengan tools encoding dan kriptografi dalam satu portal.",
};
export default function Page() { return <LandingPage />; }
