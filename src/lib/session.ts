import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "./steamAuth";

/** The signed-in player's account id from the Steam login cookie, or null. */
export async function getSessionAccountId(): Promise<number | null> {
  const store = await cookies();
  try {
    return verifySessionCookieValue(store.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    // SESSION_SECRET isn't configured - nobody can be signed in.
    return null;
  }
}
