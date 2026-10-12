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
  // Food & Drink
  if (tags.tourism === "museum") return "museum";
  if (tags.amenity === "restaurant") return "restaurant";
  if (tags.amenity === "cafe") return "cafe";
  if (tags.amenity === "bar") return "bar";
  if (tags.amenity === "fast_food") return "fast_food";
  if (tags.amenity === "biergarten") return "biergarten";
  if (tags.amenity === "pub") return "pub";
  if (tags.amenity === "food_court") return "food_court";
  if (tags.amenity === "ice_cream") return "ice_cream";
  
  // Food Shops
  if (tags.shop === "bakery") return "bakery";
  if (tags.shop === "pastry") return "pastry";
  if (tags.shop === "chocolate") return "chocolate";
  if (tags.shop === "confectionery") return "confectionery";
  if (tags.shop === "ice_cream") return "ice_cream";
  if (tags.shop === "coffee") return "coffee";
  if (tags.shop === "tea") return "tea";
  if (tags.shop === "butcher") return "butcher";
  if (tags.shop === "cheese") return "cheese";
  if (tags.shop === "deli") return "deli";
  if (tags.shop === "seafood") return "seafood";
  if (tags.shop === "farm") return "farm";
  if (tags.shop === "greengrocer") return "greengrocer";
  
  // Groceries
  if (tags.shop === "supermarket") return "supermarket";
  if (tags.shop === "convenience") return "convenience";
  if (tags.shop === "department_store") return "department_store";
  if (tags.shop === "wholesale") return "wholesale";
  if (tags.shop === "organic") return "organic";
  if (tags.shop === "health_food") return "health_food";
  
  // Healthcare
  if (tags.amenity === "pharmacy") return "pharmacy";
  if (tags.amenity === "doctors") return "doctor";
  if (tags.amenity === "dentist") return "dentist";
  if (tags.amenity === "veterinary") return "veterinary";
  if (tags.amenity === "clinic") return "clinic";
  if (tags.amenity === "hospital") return "hospital";
  if (tags.amenity === "optometrist") return "optometrist";
  if (tags.amenity === "physiotherapist") return "physiotherapist";
  
  // Personal Services & Beauty
  if (tags.amenity === "hairdresser") return "hairdresser";
  if (tags.amenity === "beauty_salon") return "beauty_salon";
  if (tags.amenity === "spa") return "spa";
  if (tags.amenity === "massage") return "massage";
  if (tags.amenity === "tattoo") return "tattoo";
  if (tags.amenity === "nail_salon") return "nail_salon";
  if (tags.shop === "hairdresser") return "hairdresser";
  if (tags.shop === "beauty") return "beauty";
  if (tags.shop === "cosmetics") return "cosmetics";
  if (tags.shop === "perfumery") return "perfumery";
  
  // Financial & Postal
  if (tags.amenity === "bank") return "bank";
  if (tags.amenity === "atm") return "atm";
  if (tags.amenity === "post_office") return "post_office";
  if (tags.amenity === "money_transfer") return "money_transfer";
  if (tags.office === "financial") return "financial";
  if (tags.office === "insurance") return "insurance";
  if (tags.office === "tax_advisor") return "tax_advisor";
  
  // Automotive & Transport
  if (tags.amenity === "fuel") return "fuel";
  if (tags.amenity === "charging_station") return "charging_station";
  if (tags.amenity === "car_wash") return "car_wash";
  if (tags.amenity === "car_repair") return "car_repair";
  if (tags.amenity === "car_rental") return "car_rental";
  if (tags.amenity === "bicycle_rental") return "bicycle_rental";
  if (tags.amenity === "parking") return "parking";
  if (tags.amenity === "parking_space") return "parking";
  if (tags.shop === "car") return "car_dealer";
  if (tags.shop === "car_parts") return "car_parts";
  if (tags.shop === "bicycle") return "bicycle_shop";
  if (tags.shop === "motorcycle") return "motorcycle_shop";
  if (tags.shop === "tyres") return "tyres";
  
  // Accommodation
  if (tags.tourism === "hotel") return "hotel";
  if (tags.tourism === "guest_house") return "guest_house";
  if (tags.tourism === "hostel") return "hostel";
  if (tags.tourism === "camp_site") return "camp_site";
  if (tags.tourism === "apartment") return "apartment";
  if (tags.tourism === "motel") return "motel";
  if (tags.tourism === "alpine_hut") return "alpine_hut";
  
  // Tourism & Culture
  if (tags.tourism === "gallery") return "gallery";
  if (tags.tourism === "artwork") return "artwork";
  if (tags.tourism === "information") return "tourist_info";
  if (tags.tourism === "viewpoint") return "viewpoint";
  if (tags.tourism === "attraction") return "attraction";
  if (tags.historic === "monument") return "monument";
  if (tags.historic === "memorial") return "memorial";
  if (tags.historic === "castle") return "castle";
  if (tags.historic === "church") return "church";
  if (tags.historic === "wayside_shrine") return "wayside_shrine";
  if (tags.historic === "ruins") return "ruins";
  if (tags.historic === "archaeological_site") return "archaeological_site";
  
  // Leisure & Parks
  if (tags.leisure === "park") return "park";
  if (tags.leisure === "playground") return "playground";
  if (tags.leisure === "garden") return "garden";
  if (tags.leisure === "nature_reserve") return "nature_reserve";
  
  // Sports & Fitness
  if (tags.leisure === "sports_centre") return "sports_centre";
  if (tags.leisure === "fitness_centre") return "gym";
  if (tags.leisure === "swimming_pool") return "swimming_pool";
  if (tags.leisure === "stadium") return "stadium";
  if (tags.leisure === "pitch") return "pitch";
  if (tags.leisure === "track") return "track";
  if (tags.leisure === "golf_course") return "golf_course";
  if (tags.leisure === "tennis_court") return "tennis_court";
  if (tags.leisure === "ice_rink") return "ice_rink";
  if (tags.leisure === "bowling_alley") return "bowling_alley";
  if (tags.leisure === "climbing") return "climbing";
  if (tags.leisure === "fitness_station") return "fitness_station";
  
  // Entertainment
  if (tags.amenity === "cinema") return "cinema";
  if (tags.amenity === "theatre") return "theatre";
  if (tags.amenity === "nightclub") return "nightclub";
  if (tags.amenity === "casino") return "casino";
  if (tags.amenity === "music_venue") return "music_venue";
  if (tags.amenity === "community_centre") return "community_centre";
  if (tags.amenity === "events_venue") return "events_venue";
  if (tags.leisure === "adventure_park") return "adventure_park";
  if (tags.leisure === "water_park") return "water_park";
  if (tags.leisure === "miniature_golf") return "miniature_golf";
  
  // Shopping - Clothing, Electronics, Home
  if (tags.shop === "clothes") return "clothes";
  if (tags.shop === "shoes") return "shoes";
  if (tags.shop === "fashion") return "fashion";
  if (tags.shop === "boutique") return "boutique";
  if (tags.shop === "jewelry") return "jewelry";
  if (tags.shop === "watch") return "watch";
  if (tags.shop === "bag") return "bag";
  if (tags.shop === "electronics") return "electronics";
  if (tags.shop === "mobile_phone") return "mobile_phone";
  if (tags.shop === "computer") return "computer";
  if (tags.shop === "appliance") return "appliance";
  if (tags.shop === "furniture") return "furniture";
  if (tags.shop === "interior_decoration") return "interior_decoration";
  if (tags.shop === "lighting") return "lighting";
  if (tags.shop === "carpet") return "carpet";
  if (tags.shop === "curtain") return "curtain";
  if (tags.shop === "florist") return "florist";
  if (tags.shop === "gift") return "gift";
  if (tags.shop === "books") return "books";
  if (tags.shop === "stationery") return "stationery";
  if (tags.shop === "newsagent") return "newsagent";
  if (tags.shop === "tobacco") return "tobacco";
  if (tags.shop === "lottery") return "lottery";
  if (tags.shop === "optician") return "optician";
  if (tags.shop === "hearing_aids") return "hearing_aids";
  if (tags.shop === "medical_supply") return "medical_supply";
  
  // Hardware, DIY & Garden
  if (tags.shop === "hardware") return "hardware";
  if (tags.shop === "doityourself") return "hardware";
  if (tags.shop === "building_materials") return "building_materials";
  if (tags.shop === "paint") return "paint";
  if (tags.shop === "tiles") return "tiles";
  if (tags.shop === "flooring") return "flooring";
  if (tags.shop === "windows") return "windows";
  if (tags.shop === "doors") return "doors";
  if (tags.shop === "garden_centre") return "garden_centre";
  if (tags.shop === "nursery") return "nursery";
  if (tags.shop === "agrarian") return "agrarian";
  if (tags.shop === "pet") return "pet_shop";
  if (tags.shop === "pet_grooming") return "pet_grooming";
  
  // Crafts & Trades (Handwerk)
  if (tags.craft === "carpenter") return "carpenter";
  if (tags.craft === "electrician") return "electrician";
  if (tags.craft === "plumber") return "plumber";
  if (tags.craft === "painter") return "painter";
  if (tags.craft === "locksmith") return "locksmith";
  if (tags.craft === "joiner") return "joiner";
  if (tags.craft === "roofer") return "roofer";
  if (tags.craft === "glazier") return "glazier";
  if (tags.craft === "chimney_sweep") return "chimney_sweep";
  if (tags.craft === "hvac") return "hvac";
  if (tags.craft === "solar") return "solar";
  if (tags.craft === "floorer") return "floorer";
  if (tags.craft === "tiler") return "tiler";
  if (tags.craft === "stonemason") return "stonemason";
  if (tags.craft === "metal_construction") return "metal_construction";
  if (tags.craft === "blacksmith") return "blacksmith";
  if (tags.craft === "upholsterer") return "upholsterer";
  if (tags.craft === "tailor") return "tailor";
  if (tags.craft === "watchmaker") return "watchmaker";
  if (tags.craft === "optician") return "optician";
  if (tags.craft === "photographer") return "photographer";
  if (tags.craft === "bakery") return "bakery";
  if (tags.craft === "butcher") return "butcher";
  if (tags.craft === "brewery") return "brewery";
  if (tags.craft === "distillery") return "distillery";
  if (tags.craft === "winery") return "winery";
  if (tags.craft === "cheese") return "cheese";
  if (tags.craft === "confectionery") return "confectionery";
  
  // Education & Public Services
  if (tags.amenity === "school") return "school";
  if (tags.amenity === "university") return "university";
  if (tags.amenity === "college") return "college";
  if (tags.amenity === "kindergarten") return "kindergarten";
  if (tags.amenity === "library") return "library";
  if (tags.amenity === "language_school") return "language_school";
  if (tags.amenity === "driving_school") return "driving_school";
  if (tags.amenity === "music_school") return "music_school";
  if (tags.amenity === "art_school") return "art_school";
  if (tags.office === "government") return "government";
  if (tags.office === "administrative") return "administrative";
  if (tags.office === "employment_agency") return "employment_agency";
  if (tags.office === "lawyer") return "lawyer";
  if (tags.office === "notary") return "notary";
  if (tags.office === "architect") return "architect";
  if (tags.office === "engineer") return "engineer";
  if (tags.office === "surveyor") return "surveyor";
  if (tags.office === "accountant") return "accountant";
  if (tags.office === "real_estate") return "real_estate";
  if (tags.office === "moving_company") return "moving_company";
  if (tags.office === "cleaning") return "cleaning";
  if (tags.office === "security") return "security";
  
  // Pet Services
  if (tags.amenity === "veterinary") return "veterinary";
  if (tags.shop === "pet") return "pet_shop";
  if (tags.shop === "pet_grooming") return "pet_grooming";
  if (tags.shop === "pet_food") return "pet_food";
  if (tags.amenity === "animal_shelter") return "animal_shelter";
  if (tags.amenity === "animal_boarding") return "animal_boarding";
  
  return null;
}

// Batch queries by OSM tag type to keep each query small enough for Overpass
const queryBatches: string[][] = [
  // Batch 1: Food & Drink - Restaurants, Cafes, Bars
  [
    `node["amenity"="restaurant"]`,
    `node["amenity"="cafe"]`,
    `node["amenity"="bar"]`,
    `node["amenity"="fast_food"]`,
    `node["amenity"="biergarten"]`,
    `node["amenity"="pub"]`,
    `node["amenity"="food_court"]`,
    `node["amenity"="ice_cream"]`,
  ],
  // Batch 2: Food Shops - Bakeries, Specialty Food
  [
    `node["shop"="bakery"]`,
    `node["shop"="pastry"]`,
    `node["shop"="chocolate"]`,
    `node["shop"="confectionery"]`,
    `node["shop"="ice_cream"]`,
    `node["shop"="coffee"]`,
    `node["shop"="tea"]`,
    `node["shop"="butcher"]`,
    `node["shop"="cheese"]`,
    `node["shop"="deli"]`,
    `node["shop"="seafood"]`,
    `node["shop"="farm"]`,
    `node["shop"="greengrocer"]`,
  ],
  // Batch 3: Groceries & Supermarkets
  [
    `node["shop"="supermarket"]`,
    `node["shop"="convenience"]`,
    `node["shop"="department_store"]`,
    `node["shop"="wholesale"]`,
    `node["shop"="organic"]`,
    `node["shop"="health_food"]`,
  ],
  // Batch 4: Healthcare & Pharmacy
  [
    `node["amenity"="pharmacy"]`,
    `node["amenity"="doctors"]`,
    `node["amenity"="dentist"]`,
    `node["amenity"="veterinary"]`,
    `node["amenity"="clinic"]`,
    `node["amenity"="hospital"]`,
    `node["amenity"="optometrist"]`,
    `node["amenity"="physiotherapist"]`,
  ],
  // Batch 5: Personal Services & Beauty
  [
    `node["amenity"="hairdresser"]`,
    `node["amenity"="beauty_salon"]`,
    `node["amenity"="spa"]`,
    `node["amenity"="massage"]`,
    `node["amenity"="tattoo"]`,
    `node["amenity"="nail_salon"]`,
    `node["shop"="hairdresser"]`,
    `node["shop"="beauty"]`,
    `node["shop"="cosmetics"]`,
    `node["shop"="perfumery"]`,
  ],
  // Batch 6: Financial & Postal Services
  [
    `node["amenity"="bank"]`,
    `node["amenity"="atm"]`,
    `node["amenity"="post_office"]`,
    `node["amenity"="money_transfer"]`,
    `node["office"="financial"]`,
    `node["office"="insurance"]`,
    `node["office"="tax_advisor"]`,
  ],
  // Batch 7: Automotive & Transport
  [
    `node["amenity"="fuel"]`,
    `node["amenity"="charging_station"]`,
    `node["amenity"="car_wash"]`,
    `node["amenity"="car_repair"]`,
    `node["amenity"="car_rental"]`,
    `node["amenity"="bicycle_rental"]`,
    `node["amenity"="parking"]`,
    `node["amenity"="parking_space"]`,
    `node["shop"="car"]`,
    `node["shop"="car_parts"]`,
    `node["shop"="bicycle"]`,
    `node["shop"="motorcycle"]`,
    `node["shop"="tyres"]`,
  ],
  // Batch 8: Accommodation & Tourism
  [
    `node["tourism"="hotel"]`,
    `node["tourism"="guest_house"]`,
    `node["tourism"="hostel"]`,
    `node["tourism"="camp_site"]`,
    `node["tourism"="apartment"]`,
    `node["tourism"="motel"]`,
    `node["tourism"="alpine_hut"]`,
    `node["tourism"="information"]`,
    `node["tourism"="viewpoint"]`,
    `node["tourism"="attraction"]`,
  ],
  // Batch 9: Culture, Historic & Leisure
  [
    `node["tourism"="museum"]`,
    `node["tourism"="gallery"]`,
    `node["tourism"="artwork"]`,
    `node["historic"="monument"]`,
    `node["historic"="memorial"]`,
    `node["historic"="castle"]`,
    `node["historic"="church"]`,
    `node["historic"="wayside_shrine"]`,
    `node["historic"="ruins"]`,
    `node["historic"="archaeological_site"]`,
    `node["leisure"="park"]`,
    `node["leisure"="playground"]`,
    `node["leisure"="garden"]`,
    `node["leisure"="nature_reserve"]`,
  ],
  // Batch 10: Sports & Fitness
  [
    `node["leisure"="sports_centre"]`,
    `node["leisure"="fitness_centre"]`,
    `node["leisure"="swimming_pool"]`,
    `node["leisure"="stadium"]`,
    `node["leisure"="pitch"]`,
    `node["leisure"="track"]`,
    `node["leisure"="golf_course"]`,
    `node["leisure"="tennis_court"]`,
    `node["leisure"="ice_rink"]`,
    `node["leisure"="bowling_alley"]`,
    `node["leisure"="climbing"]`,
    `node["leisure"="fitness_station"]`,
  ],
  // Batch 11: Entertainment & Nightlife
  [
    `node["amenity"="cinema"]`,
    `node["amenity"="theatre"]`,
    `node["amenity"="nightclub"]`,
    `node["amenity"="casino"]`,
    `node["amenity"="music_venue"]`,
    `node["amenity"="community_centre"]`,
    `node["amenity"="events_venue"]`,
    `node["leisure"="adventure_park"]`,
    `node["leisure"="water_park"]`,
    `node["leisure"="miniature_golf"]`,
  ],
  // Batch 12: Shopping - Clothing, Electronics, Home
  [
    `node["shop"="clothes"]`,
    `node["shop"="shoes"]`,
    `node["shop"="fashion"]`,
    `node["shop"="boutique"]`,
    `node["shop"="jewelry"]`,
    `node["shop"="watch"]`,
    `node["shop"="bag"]`,
    `node["shop"="electronics"]`,
    `node["shop"="mobile_phone"]`,
    `node["shop"="computer"]`,
    `node["shop"="appliance"]`,
    `node["shop"="furniture"]`,
    `node["shop"="interior_decoration"]`,
    `node["shop"="lighting"]`,
    `node["shop"="carpet"]`,
    `node["shop"="curtain"]`,
    `node["shop"="florist"]`,
    `node["shop"="gift"]`,
    `node["shop"="books"]`,
    `node["shop"="stationery"]`,
    `node["shop"="newsagent"]`,
    `node["shop"="tobacco"]`,
    `node["shop"="lottery"]`,
    `node["shop"="optician"]`,
    `node["shop"="hearing_aids"]`,
    `node["shop"="medical_supply"]`,
  ],
  // Batch 13: Hardware, DIY & Garden
  [
    `node["shop"="hardware"]`,
    `node["shop"="doityourself"]`,
    `node["shop"="building_materials"]`,
    `node["shop"="paint"]`,
    `node["shop"="tiles"]`,
    `node["shop"="flooring"]`,
    `node["shop"="windows"]`,
    `node["shop"="doors"]`,
    `node["shop"="garden_centre"]`,
    `node["shop"="nursery"]`,
    `node["shop"="agrarian"]`,
    `node["shop"="pet"]`,
    `node["shop"="pet_grooming"]`,
  ],
  // Batch 14: Crafts & Trades (Handwerk)
  [
    `node["craft"="carpenter"]`,
    `node["craft"="electrician"]`,
    `node["craft"="plumber"]`,
    `node["craft"="painter"]`,
    `node["craft"="locksmith"]`,
    `node["craft"="joiner"]`,
    `node["craft"="roofer"]`,
    `node["craft"="glazier"]`,
    `node["craft"="chimney_sweep"]`,
    `node["craft"="hvac"]`,
    `node["craft"="solar"]`,
    `node["craft"="floorer"]`,
    `node["craft"="tiler"]`,
    `node["craft"="stonemason"]`,
    `node["craft"="metal_construction"]`,
    `node["craft"="blacksmith"]`,
    `node["craft"="upholsterer"]`,
    `node["craft"="tailor"]`,
    `node["craft"="watchmaker"]`,
    `node["craft"="optician"]`,
    `node["craft"="photographer"]`,
    `node["craft"="bakery"]`,
    `node["craft"="butcher"]`,
    `node["craft"="brewery"]`,
    `node["craft"="distillery"]`,
    `node["craft"="winery"]`,
    `node["craft"="cheese"]`,
    `node["craft"="confectionery"]`,
  ],
  // Batch 15: Education & Public Services
  [
    `node["amenity"="school"]`,
    `node["amenity"="university"]`,
    `node["amenity"="college"]`,
    `node["amenity"="kindergarten"]`,
    `node["amenity"="library"]`,
    `node["amenity"="language_school"]`,
    `node["amenity"="driving_school"]`,
    `node["amenity"="music_school"]`,
    `node["amenity"="art_school"]`,
    `node["office"="government"]`,
    `node["office"="administrative"]`,
    `node["office"="employment_agency"]`,
    `node["office"="lawyer"]`,
    `node["office"="notary"]`,
    `node["office"="architect"]`,
    `node["office"="engineer"]`,
    `node["office"="surveyor"]`,
    `node["office"="accountant"]`,
    `node["office"="real_estate"]`,
    `node["office"="moving_company"]`,
    `node["office"="cleaning"]`,
    `node["office"="security"]`,
  ],
  // Batch 16: Pet Services
  [
    `node["amenity"="veterinary"]`,
    `node["shop"="pet"]`,
    `node["shop"="pet_grooming"]`,
    `node["shop"="pet_food"]`,
    `node["amenity"="animal_shelter"]`,
    `node["amenity"="animal_boarding"]`,
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
