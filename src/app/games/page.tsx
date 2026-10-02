import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionAccountId } from "@/lib/session";
import { MyGames, type GamesFilter } from "@/components/MyGames";

export const metadata: Metadata = {
  title: "Мои игры - Dota Coach AI",
};

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const accountId = await getSessionAccountId();
  if (!accountId) redirect("/");

  const { filter } = await searchParams;
  const active: GamesFilter = filter === "wins" || filter === "losses" ? filter : "all";
  return <MyGames accountId={accountId} filter={active} />;
}
