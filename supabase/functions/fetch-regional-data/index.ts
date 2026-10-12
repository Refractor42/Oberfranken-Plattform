// Edge function: fetch regional weather (Bright Sky) and places (Overpass/OSM) for all Oberfranken regions
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type RegionCoord = {
  name: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number];
};

const regionCoords: RegionCoord[] = [
  { name: "Bamberg", lat: 49.8987, lon: 10.9007, bbox: [49.84, 10.78, 49.96, 11.00] },
  { name: "Bayreuth", lat: 49.9482, lon: 11.5783, bbox: [49.90, 11.50, 49.99, 11.66] },
  { name: "Coburg", lat: 50.2590, lon: 10.9655, bbox: [50.22, 10.92, 50.30, 11.02] },
  { name: "Forchheim", lat: 49.7188, lon: 11.0589, bbox: [49.68, 11.01, 49.76, 11.11] },
  { name: "Hof", lat: 50.3126, lon: 11.9125, bbox: [50.27, 11.86, 50.35, 11.96] },
  { name: "Kronach", lat: 50.1440, lon: 11.3290, bbox: [50.10, 11.28, 50.19, 11.38] },
  { name: "Kulmbach", lat: 50.0990, lon: 11.4450, bbox: [50.05, 11.39, 50.15, 11.50] },
  { name: "Lichtenfels", lat: 50.1459, lon: 11.0728, bbox: [50.10, 11.02, 50.19, 11.12] },
  { name: "Wunsiedel", lat: 50.0370, lon: 12.0060, bbox: [49.99, 11.96, 50.08, 12.06] },
];

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type BrightSkyWeather = {
  temperature: number;
  wind_speed_10: number;
  wind_speed_60: number;
  precipitation_60: number;
  relative_humidity: number;
  condition: string;
  icon: string;
};

type BrightSkyResponse = {
  weather: BrightSkyWeather;
  sources: unknown[];
};

async function fetchWeather(region: RegionCoord): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const url = `https://api.brightsky.dev/current_weather?lat=${region.lat}&lon=${region.lon}&date=${today}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bright Sky failed for ${region.name}: ${res.status}`);
  const data: BrightSkyResponse = await res.json();
  const w = data.weather;
  if (!w) throw new Error(`No weather data for ${region.name}`);

  const { error } = await supabase
    .from("weather_snapshots")
    .upsert(
      {
        region: region.name,
        lat: region.lat,
        lon: region.lon,
        temperature: Math.round(w.temperature),
        temp_min: Math.round(w.temperature - 3),
        temp_max: Math.round(w.temperature + 3),
        description: w.condition,
        icon: w.icon,
        wind_speed: Math.round(w.wind_speed_60 || w.wind_speed_10 || 0),
        precipitation: w.precipitation_60 || 0,
        humidity: w.relative_humidity,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "region" },
    );
  if (error) throw new Error(`DB upsert failed for weather ${region.name}: ${error.message}`);
}

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
};

type OverpassResponse = { elements: OverpassElement[] };

function detectCategory(tags: Record<string, string>): string | null {
  if (tags.tourism === "museum") return "museum";
  if (tags.amenity === "restaurant") return "restaurant";
  if (tags.amenity === "cafe") return "cafe";
  if (tags.amenity === "bar") return "bar";
  if (tags.amenity === "fast_food") return "fast_food";
  if (tags.shop === "bakery") return "bakery";
  if (tags.shop === "supermarket") return "supermarket";
  if (tags.amenity === "pharmacy") return "pharmacy";
  if (tags.amenity === "bank") return "bank";
  if (tags.shop === "hairdresser") return "hairdresser";
  if (tags.amenity === "car_wash") return "car_wash";
  if (tags.shop === "car_repair") return "car_repair";
  if (tags.amenity === "fuel") return "fuel";
  if (tags.craft === "plumber") return "plumber";
  if (tags.craft === "electrician") return "electrician";
  if (tags.shop === "beauty") return "beauty";
  if (tags.shop === "florist") return "florist";
  if (tags.shop === "clothes") return "clothes";
  if (tags.shop === "doityourself") return "hardware";
  if (tags.amenity === "dentist") return "dentist";
  if (tags.amenity === "doctors") return "doctor";
  if (tags.shop === "optician") return "optician";
  if (tags.leisure === "fitness_centre") return "gym";
  if (tags.tourism === "hotel") return "hotel";
  if (tags.amenity === "post_office") return "post_office";
  if (tags.amenity === "library") return "library";
  if (tags.amenity === "cinema") return "cinema";
  if (tags.amenity === "atm") return "atm";
  return null;
}

// Batch queries by OSM tag type to keep each query small enough for Overpass
const queryBatches: string[][] = [
  // Batch 1: amenity-based categories
  [
    `node["amenity"="restaurant"]`,
    `node["amenity"="cafe"]`,
    `node["amenity"="bar"]`,
    `node["amenity"="fast_food"]`,
    `node["amenity"="pharmacy"]`,
    `node["amenity"="bank"]`,
    `node["amenity"="fuel"]`,
    `node["amenity"="dentist"]`,
    `node["amenity"="doctors"]`,
    `node["amenity"="car_wash"]`,
    `node["amenity"="post_office"]`,
    `node["amenity"="library"]`,
    `node["amenity"="cinema"]`,
    `node["amenity"="atm"]`,
  ],
  // Batch 2: shop-based categories
  [
    `node["shop"="bakery"]`,
    `node["shop"="supermarket"]`,
    `node["shop"="hairdresser"]`,
    `node["shop"="car_repair"]`,
    `node["shop"="beauty"]`,
    `node["shop"="florist"]`,
    `node["shop"="clothes"]`,
    `node["shop"="doityourself"]`,
    `node["shop"="optician"]`,
  ],
  // Batch 3: tourism, craft, leisure
  [
    `node["tourism"="museum"]`,
    `node["tourism"="hotel"]`,
    `node["craft"="plumber"]`,
    `node["craft"="electrician"]`,
    `node["leisure"="fitness_centre"]`,
  ],
];

async function overpassFetch(query: string): Promise<OverpassElement[]> {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Oberfranken-Plattform/1.0 (regional data fetch)",
    },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
  const data: OverpassResponse = await res.json();
  return data.elements;
}

async function fetchPlaces(region: RegionCoord): Promise<void> {
  const [s, w, n, e] = region.bbox;
  const allRows: Record<string, unknown>[] = [];
  const seenIds = new Set<number>();

  for (const batch of queryBatches) {
    const selectors = batch.map((sel) => `${sel}(${s},${w},${n},${e});`).join("");
    const query = `[out:json][timeout:20];(${selectors});out tags center 200;`;
    try {
      const elements = await overpassFetch(query);
      for (const el of elements) {
        if (!el.tags?.name || seenIds.has(el.id)) continue;
        seenIds.add(el.id);
        const category = detectCategory(el.tags);
        if (!category) continue;
        allRows.push({
          osm_id: el.id,
          name: el.tags.name,
          category,
          region: region.name,
          lat: el.lat ?? el.center?.lat ?? null,
          lon: el.lon ?? el.center?.lon ?? null,
          opening_hours: el.tags.opening_hours || null,
          cuisine: el.tags.cuisine || null,
          website: el.tags.website || el.tags["contact:website"] || null,
          phone: el.tags.phone || el.tags["contact:phone"] || null,
          address: [el.tags["addr:street"], el.tags["addr:housenumber"]].filter(Boolean).join(" ") || null,
          description: el.tags.description || null,
          updated_at: new Date().toISOString(),
        });
      }
    } catch {
      // Skip failed batch, continue with next
    }
  }

  if (allRows.length === 0) return;

  const { error } = await supabase
    .from("regional_places")
    .upsert(allRows, { onConflict: "osm_id" });
  if (error) throw new Error(`DB upsert failed for places ${region.name}: ${error.message}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const forceRegion = url.searchParams.get("region");

    const targets = forceRegion
      ? regionCoords.filter((r) => r.name.toLowerCase() === forceRegion.toLowerCase())
      : regionCoords;

    const results: { region: string; weather: boolean; places: boolean; error?: string }[] = [];

    for (const region of targets) {
      const result = { region: region.name, weather: false, places: false, error: undefined as string | undefined };
      try {
        await fetchWeather(region);
        result.weather = true;
      } catch (err) {
        result.error = `Weather: ${(err as Error).message}`;
      }
      try {
        await fetchPlaces(region);
        result.places = true;
      } catch (err) {
        result.error = (result.error ? result.error + "; " : "") + `Places: ${(err as Error).message}`;
      }
      results.push(result);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
