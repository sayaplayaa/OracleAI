import { getSessionAccountId } from "@/lib/session";
import { getProfile } from "@/lib/opendota";
import { HeaderNav } from "./HeaderNav";

export async function SiteHeader() {
  const accountId = await getSessionAccountId();
  const profile = accountId ? await getProfile(accountId).catch(() => null) : null;

  return (
    <HeaderNav
      session={
        accountId
          ? {
              accountId,
              personaname: profile?.profile.personaname ?? null,
              avatarfull: profile?.profile.avatarfull ?? null,
            }
          : null
      }
    />
  );
}
