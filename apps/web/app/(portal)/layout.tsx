import Navbar from "../components/navbar";
export const instant = false;
export default function Layout({ children }: { children: React.ReactNode }) {
  return <Navbar>{children}</Navbar>;
}
