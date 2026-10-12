async function testOverpass() {
  const bbox = [50.10, 11.28, 50.19, 11.38]; // Kronach
  const [s, w, n, e] = bbox;
  
  const query = `[out:json][timeout:25];
    (
      node["amenity"="restaurant"](${s},${w},${n},${e});
    );
    out tags center 200;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Oberfranken-Plattform/1.0 (regional data fetch)",
    },
    body: "data=" + encodeURIComponent(query),
  });

  if (!res.ok) {
    console.error("Overpass returned", res.status);
    return;
  }

  const data = await res.json();
  console.log(`Found ${data.elements.length} elements`);
  
  for (const el of data.elements) {
    if (el.tags?.name) {
      console.log(`- ${el.tags.name} (restaurant)`);
    }
  }
}

testOverpass().catch(console.error);