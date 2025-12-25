export const fetchCoordsFromPlace = async (place: string) => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      place
    )}&format=json&limit=1`
  );

  const data = await res.json();
  if (!data || data.length === 0) throw new Error("Place not found");

  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
  };
};

export const fetchNearbyPois = async (lat: number, lon: number) => {
  const query = `
    [out:json][timeout:25];
    (
      node["tourism"](around:3000,${lat},${lon});
      node["amenity"="restaurant"](around:3000,${lat},${lon});
      node["leisure"](around:3000,${lat},${lon});
    );
    out body;
  `;

  const res = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
  );

  const json = await res.json();

  return json.elements.map((el: any) => ({
    id: el.id,
    name: el.tags?.name ?? "Unknown",
    lat: el.lat,
    lon: el.lon,
    tags: el.tags,
  }));
};
