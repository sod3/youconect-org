import { notFound } from "next/navigation";
import { AuthPage, DemoPage, OnboardingPage } from "@/components/auth-pages";
import { ContactPage, PublicPage } from "@/components/marketing";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  return {
    title: slug
      .map((s) => s.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()))
      .join(" · "),
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const route = slug.join("/");
  if (
    [
      "login",
      "signup",
      "forgot-password",
      "reset-password",
      "verify-email",
    ].includes(route)
  )
    return <AuthPage mode={route} token={(await searchParams).token} />;
  if (route === "demo") return <DemoPage />;
  if (route === "onboarding") return <OnboardingPage />;
  if (route === "contact") return <ContactPage />;
  if (
    [
      "features",
      "solutions",
      "solutions/universities",
      "solutions/companies",
      "solutions/nonprofits",
      "solutions/training-institutes",
      "organizations",
      "pricing",
      "security",
      "about",
      "blog",
      "help",
      "terms",
      "privacy",
    ].includes(route)
  )
    return <PublicPage slug={route} />;
  notFound();
}
