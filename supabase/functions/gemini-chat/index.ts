import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type PlaceRow = {
  id: string;
  name: string;
  category: string;
  region: string;
  lat: number | null;
  lon: number | null;
  opening_hours: string | null;
  cuisine: string | null;
  website: string | null;
  address: string | null;
  description: string | null;
};
type WeatherRow = { region: string; temperature: number; description: string };
type EventRow = { title: string; starts_at: string; location: string; category: string; description: string };

function pinTypeForPlace(category: string): string {
  if (["restaurant", "cafe", "bar", "fast_food", "bakery"].includes(category)) return "restaurant";
  if (["museum", "library", "cinema", "hotel"].includes(category)) return "sight";
  return "activity";
}

const categoryLabels: Record<string, string> = {
  museum: "Museum",
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
  fast_food: "Schnellimbiss",
  bakery: "Bäckerei",
  supermarket: "Supermarkt",
  pharmacy: "Apotheke",
  bank: "Bank",
  hairdresser: "Friseur",
  car_wash: "Autowäsche",
  car_repair: "Werkstatt",
  fuel: "Tankstelle",
  plumber: "Klempner",
  electrician: "Elektriker",
  beauty: "Kosmetik",
  florist: "Blumenladen",
  clothes: "Bekleidung",
  hardware: "Baumarkt",
  dentist: "Zahnarzt",
  doctor: "Arzt",
  optician: "Optiker",
  gym: "Fitnessstudio",
  hotel: "Hotel",
  post_office: "Poststelle",
  library: "Bibliothek",
  cinema: "Kino",
  atm: "Geldautomat",
};

function pinTypeForEvent(category: string): string {
  if (category === "Kultur") return "sight";
  if (category === "Wirtschaft") return "restaurant";
  if (category === "Natur") return "activity";
  return "activity";
}

async function buildContext(region: string) {
  const [weatherRes, placesRes, eventsRes] = await Promise.all([
    supabase.from("weather_snapshots").select("region, temperature, description").eq("region", region).maybeSingle(),
    supabase.from("regional_places").select("id, name, category, region, lat, lon, opening_hours, cuisine, website, address, description").eq("region", region).order("category", { ascending: true }).limit(60),
    supabase.from("regional_events").select("title, starts_at, location, category, description").ilike("region", region).gte("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }).limit(10),
  ]);

  const weather = weatherRes.data as WeatherRow | null;
  const places = (placesRes.data as PlaceRow[] | null) || [];
  const events = (eventsRes.data as EventRow[] | null) || [];

  const eventList = events.map((e) => `  - ${e.title} am ${new Date(e.starts_at).toLocaleDateString("de-DE")} in ${e.location}: ${e.description}`);

  // Group places by category for context
  const byCategory: Record<string, typeof places> = {};
  for (const p of places) {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  }

  let contextText = `Region: ${region}\n`;
  if (weather) contextText += `Aktuelles Wetter: ${weather.temperature}°C, ${weather.description}\n`;
  for (const [cat, items] of Object.entries(byCategory)) {
    const label = categoryLabels[cat] || cat;
    const lines = items.slice(0, 5).map((p) => `  - ${p.name}${p.cuisine ? ` (${p.cuisine})` : ""}${p.opening_hours ? ` (Öffnungszeiten: ${p.opening_hours})` : ""}${p.address ? `, ${p.address}` : ""}`);
    contextText += `${label}:\n${lines.join("\n")}\n`;
  }
  if (eventList.length) contextText += `Anstehende Termine:\n${eventList.join("\n")}\n`;

  const allPlaces: { name: string; lat: number; lon: number; pin_type: string; category: string; region: string; address: string | null; description: string | null }[] = [];
  for (const p of places) {
    const lat = typeof p.lat === 'string' ? parseFloat(p.lat) : p.lat;
    const lon = typeof p.lon === 'string' ? parseFloat(p.lon) : p.lon;
    if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
      allPlaces.push({ name: p.name, lat, lon, pin_type: pinTypeForPlace(p.category), category: p.category, region: p.region, address: p.address, description: p.description });
    }
  }

  return { contextText, places: allPlaces, events: events.map((e) => ({ title: e.title, location: e.location, category: e.category, pin_type: pinTypeForEvent(e.category), description: e.description })) };
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
  const res = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!answer) throw new Error("Gemini returned empty response");
  return answer;
}

async function callDeepSeek(prompt: string): Promise<string> {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-r1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("DeepSeek returned empty response");
  const answer = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!answer) throw new Error("DeepSeek returned empty response after stripping think tags");
  return answer;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const message = body?.message as string;
    const region = body?.region as string || "Bamberg";
    const interests = (body?.interests as string[]) || [];
    const userLat = body?.userLat as number | undefined;
    const userLon = body?.userLon as number | undefined;

    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: "Keine Frage übermittelt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!geminiKey && !deepseekKey) {
      return new Response(JSON.stringify({
        answer: "Hansla ist noch nicht vollständig konfiguriert. Bitte füge einen API Key hinzu, um die Funktion zu aktivieren.",
        places: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { contextText, places, events } = await buildContext(region);
    const interestStr = interests.length > 0 ? `\nDie Interessen des Nutzers sind: ${interests.join(", ")}. Gehe darauf ein.` : "";
    const locationStr = (userLat != null && userLon != null) ? `\nDer Nutzer befindet sich ungefähr bei den Koordinaten ${userLat.toFixed(4)}, ${userLon.toFixed(4)}. Wenn nach Orten gefragt wird, bevorzuge solche, die näher an diesem Standort sind.` : "";

    const prompt = `Du bist "Hansla", der persönliche KI-Assistent und Reiseführer für die Region Oberfranken in Deutschland. Du bist hilfsbereit, freundlich, kenntnisreich und antwortest auf Deutsch. Du beantwortest Fragen zu Restaurants, Sehenswürdigkeiten, Aktivitäten, Events, Dienstleistern (Klempner, Elektriker, Werkstätten, Apotheken, etc.) und Tipps in Oberfranken. Du kannst auch allgemeine Fragen beantworten, aber dein Spezialgebiet ist Oberfranken.

Hier sind aktuelle Daten zur Region "${region}":

${contextText}
${interestStr}
${locationStr}

Beantworte die Frage des Nutzers basierend auf diesen Daten. Wenn die Daten nicht ausreichen, gib ehrlich an, dass du keine genauen Informationen hast, aber gib trotzdem eine hilfreiche Empfehlung. Erwähne konkrete Orte, Events und Wetter, wenn relevant. Halte die Antwort natürlich und angenehm (max. 4 Sätze).

Frage: ${message}`;

    let answer: string;
    let lastError = "";
    try {
      answer = await callGemini(prompt);
    } catch (geminiErr) {
      lastError = `Gemini: ${(geminiErr as Error).message}`;
      console.error("Gemini failed, falling back to DeepSeek:", geminiErr);
      try {
        answer = await callDeepSeek(prompt);
      } catch (deepseekErr) {
        lastError += ` | DeepSeek: ${(deepseekErr as Error).message}`;
        console.error("DeepSeek also failed:", deepseekErr);
        return new Response(JSON.stringify({
          answer: "Hansla konnte gerade nicht antworten. Versuche es in einem Moment noch einmal.",
          places: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const messageLower = message.toLowerCase();
    const relevantPlaces = places.filter((p) => {
      if (/ess|eat|restaurant|gast|fränkisch|bier|brau|küche|food|hung/.test(messageLower)) return ["restaurant", "cafe", "bar", "fast_food", "bakery"].includes(p.category);
      if (/sehenswürdig|musée|museum|burg|schloss|kultur|sight|sehen|kunst|geschichte|hotel|übernacht/.test(messageLower)) return ["museum", "hotel", "library", "cinema"].includes(p.category);
      if (/aktiv|spazier|wander|natur|park|wald|see|bad|sport|outdoor|familie|kind/.test(messageLower)) return ["gym", "cinema"].includes(p.category);
      if (/klempner|plumber|rohr|wasser/.test(messageLower)) return p.category === "plumber";
      if (/elektr|electric|strom|elektriker/.test(messageLower)) return p.category === "electrician";
      if (/auto|car|tank|fuel|werkstatt|repair|wäsche|wash/.test(messageLower)) return ["car_wash", "car_repair", "fuel"].includes(p.category);
      if (/apothe|pharma|arzt|doctor|zahn|dentist|gesund/.test(messageLower)) return ["pharmacy", "doctor", "dentist"].includes(p.category);
      if (/friseur|hair|beauty|kosmet/.test(messageLower)) return ["hairdresser", "beauty"].includes(p.category);
      if (/bank|geld|atm|cash/.test(messageLower)) return ["bank", "atm"].includes(p.category);
      if (/supermarkt|einkauf|shop|bäck|backery|kleidung|clothes|blumen|florist|baumarkt|hardware/.test(messageLower)) return ["supermarket", "bakery", "clothes", "florist", "hardware"].includes(p.category);
      if (/post/.test(messageLower)) return p.category === "post_office";
      if (/optik|brille|optician/.test(messageLower)) return p.category === "optician";
      return true;
    });

    let mapPlaces = relevantPlaces.length > 0 ? relevantPlaces.slice(0, 8) : places.slice(0, 8);

    // If user has GPS coords, sort by distance and prefer nearby places
    if (userLat != null && userLon != null && mapPlaces.length > 0) {
      mapPlaces = [...mapPlaces].sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.lat - userLat, 2) + Math.pow(a.lon - userLon, 2));
        const distB = Math.sqrt(Math.pow(b.lat - userLat, 2) + Math.pow(b.lon - userLon, 2));
        return distA - distB;
      }).slice(0, 8);
    }

    return new Response(JSON.stringify({ answer, places: mapPlaces }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
