const ROOT = "https://archive.org";
export const COLLECTION = "https://archive.org/details/blocsonic";
export const asText = (value) =>
  Array.isArray(value) ? value.join("، ") : String(value || "");
export const artwork = (id) => `${ROOT}/services/img/${encodeURIComponent(id)}`;
export async function searchAlbums(term = "", page = 1, signal) {
  const words = term.trim().split(/\s+/).filter(Boolean).slice(0, 12);
  const safe = words
    .map((word) => word.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter(Boolean);
  const query = `collection:blocsonic AND mediatype:audio AND licenseurl:*${safe.length ? ` AND (${safe.map((w) => `"${w}"`).join(" AND ")})` : ""}`;
  const params = new URLSearchParams({
    q: query,
    output: "json",
    rows: "18",
    page: String(page),
  });
  ["identifier", "title", "creator", "licenseurl", "year"].forEach((f) =>
    params.append("fl[]", f),
  );
  params.append("sort[]", "downloads desc");
  const res = await fetch(`${ROOT}/advancedsearch.php?${params}`, { signal });
  if (!res.ok)
    throw new Error("تعذّر الوصول إلى كتالوج الموسيقى. حاول مرة أخرى.");
  const body = await res.json();
  if (!Array.isArray(body.response?.docs))
    throw new Error("استجابة غير متوقعة من الكتالوج.");
  return { albums: body.response.docs, total: body.response.numFound };
}
export async function loadAlbum(id, signal) {
  const res = await fetch(`${ROOT}/metadata/${encodeURIComponent(id)}`, {
    signal,
  });
  if (!res.ok) throw new Error("تعذّر تحميل مقاطع الألبوم.");
  const data = await res.json();
  const metadata = data.metadata || {};
  const license = asText(metadata.licenseurl);
  if (!/^https?:\/\/(www\.)?creativecommons\.org\//i.test(license))
    throw new Error("لا يتوفر ترخيص واضح لهذا الألبوم.");
  const seen = new Set();
  const tracks = (data.files || [])
    .filter((f) => /\.mp3$/i.test(f.name) && !f.private)
    .filter((f) => {
      const key = asText(f.title) || f.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((f) => ({
      id: `${id}/${f.name}`,
      albumId: id,
      title: asText(f.title) || f.name.replace(/\.mp3$/i, ""),
      artist: asText(f.creator || metadata.creator) || "فنان مستقل",
      album: asText(metadata.title),
      duration: f.length,
      url: `${ROOT}/download/${encodeURIComponent(id)}/${encodeURIComponent(f.name)}`,
      cover: artwork(id),
      license: license.replace(/^http:/, "https:"),
      source: `${ROOT}/details/${encodeURIComponent(id)}`,
    }));
  if (!tracks.length)
    throw new Error("لا تتوفر مقاطع MP3 قابلة للتشغيل لهذا الألبوم.");
  return {
    title: asText(metadata.title),
    artist: asText(metadata.creator),
    tracks,
    license: tracks[0].license,
    id,
  };
}
