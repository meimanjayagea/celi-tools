import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditProfileForm from "./edit-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, bio")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-bold">Profil</h1>
      <div className="flex items-center gap-4 rounded border bg-white p-4">
        {profile?.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="avatar" className="h-16 w-16 rounded-full" />
        )}
        <div>
          <p className="font-semibold">{profile?.full_name ?? "-"}</p>
          <p className="text-sm text-gray-600">{user.email}</p>
        </div>
      </div>
      <EditProfileForm fullName={profile?.full_name ?? ""} bio={profile?.bio ?? ""} />
    </main>
  );
}
