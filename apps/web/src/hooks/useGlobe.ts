'use client';

import { useState } from 'react';

export function useGlobe() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  return { selectedCountry, setSelectedCountry };
}
