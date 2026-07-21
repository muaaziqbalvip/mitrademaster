// /api/image-sitemap.xml.js
// Vercel Serverless Function — builds a Google Images sitemap on every
// request by reading the live screenshots[] + logoUrl from Firestore
// (config/landingPage), the same doc the admin panel writes to.
// This means every screenshot uploaded through the admin panel's ImgBB
// flow shows up here automatically — no manual sitemap edits needed.

const FIREBASE_PROJECT_ID = "mitrademaster";
const FIREBASE_API_KEY = "AIzaSyCldWSASWc8cYKugKsbUR6AyEeUcpopeRE";
const SITE_URL = "https://mitrademaster.vercel.app";

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchLandingConfig() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/config/landingPage?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const fields = json.fields || {};

  const getStr = (f) => (f && f.stringValue) || "";
  const getArr = (f) =>
    f && f.arrayValue && Array.isArray(f.arrayValue.values)
      ? f.arrayValue.values.map((v) => v.stringValue).filter(Boolean)
      : [];

  return {
    logoUrl: getStr(fields.logoUrl),
    brandName: getStr(fields.brandName) || "MI Trade Master",
    screenshots: getArr(fields.screenshots),
  };
}

module.exports = async (req, res) => {
  let config = { logoUrl: "", brandName: "MI Trade Master", screenshots: [] };
  try {
    const fetched = await fetchLandingConfig();
    if (fetched) config = fetched;
  } catch (e) {
    // Firestore unreachable — fall back to just the static logo below.
  }

  // Always include the known static logo, then whatever the admin panel
  // has published (logo override + every screenshot).
  const images = [];
  const fallbackLogo = "https://i.ibb.co/Ng388c8Z/de7fe19c8fdb.png";
  images.push({ url: config.logoUrl || fallbackLogo, title: `${config.brandName} App Icon` });
  config.screenshots.forEach((url, i) => {
    images.push({ url, title: `${config.brandName} Screenshot ${i + 1}` });
  });

  const imageTags = images
    .map(
      (img) => `    <image:image>
      <image:loc>${escapeXml(img.url)}</image:loc>
      <image:title>${escapeXml(img.title)}</image:title>
    </image:image>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE_URL}/</loc>
${imageTags}
  </url>
</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  res.status(200).send(xml);
};
