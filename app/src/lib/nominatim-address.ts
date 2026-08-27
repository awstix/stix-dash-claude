export type NominatimAddressParts = {
  city?: string;
  house_number?: string;
  municipality?: string;
  postcode?: string;
  road?: string;
  suburb?: string;
  town?: string;
  village?: string;
};

/** Baut aus den von OpenStreetMap strukturiert gelieferten Adressteilen
 * einheitlich "PLZ Ort, Straße Hausnummer" - damit landen alle
 * Baustellenadressen im selben Format und in der von OSM bestätigten
 * korrekten Schreibweise. Liefert null, wenn OSM keine Straße kennt (z.B.
 * bei einer Suche nach nur Ort/PLZ, oder wenn an der Kartenposition kein
 * Gebäude/keine Straße in der Nähe liegt). */
export function formatNominatimAddress(address: NominatimAddressParts | undefined): string | null {
  if (!address) return null;

  const place = address.city ?? address.town ?? address.village ?? address.municipality ?? address.suburb;
  const { postcode, road, house_number: houseNumber } = address;

  if (!postcode || !place || !road) return null;

  const streetLine = houseNumber ? `${road} ${houseNumber}` : road;
  return `${postcode} ${place}, ${streetLine}`;
}
