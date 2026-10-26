import type { Metadata } from "next";
import { CountryDirectory } from "@/components/country/CountryDirectory";
import { loadCountryIndex } from "@/lib/countries/server";

export const metadata: Metadata = { title: "Countries · Chrono" };

export default function CountriesPage() {
  const { countries } = loadCountryIndex();
  return <CountryDirectory countries={countries} />;
}
