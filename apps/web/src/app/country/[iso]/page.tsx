import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CountryView } from "@/components/country/CountryView";
import { loadCountry, loadCountryIndex } from "@/lib/countries/server";

// Static export: every country page is generated at build time from data/countries/.
export const dynamicParams = false;

export function generateStaticParams() {
  return loadCountryIndex().countries.map((country) => ({ iso: country.iso3.toLowerCase() }));
}

export function generateMetadata({ params }: { params: { iso: string } }): Metadata {
  const data = loadCountry(params.iso.toUpperCase());
  return { title: data ? `${data.profile.name} · Chrono` : "Chrono" };
}

export default function CountryPage({ params }: { params: { iso: string } }) {
  const data = loadCountry(params.iso.toUpperCase());
  if (!data) notFound();
  return <CountryView data={data} />;
}
