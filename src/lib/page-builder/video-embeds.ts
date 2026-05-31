export type VideoEmbed = {
  provider: "youtube";
  id: string;
  embedUrl: string;
  thumbnailUrl: string;
};

const youtubeIdPattern = /^[A-Za-z0-9_-]{6,}$/;

export function getVideoEmbed(
  url: string | null | undefined,
): VideoEmbed | null {
  const id = parseYouTubeVideoId(url);
  if (!id) return null;

  return {
    provider: "youtube",
    id,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  };
}

export function createVideoEmbedAutoplayUrl(videoEmbed: VideoEmbed) {
  return `${videoEmbed.embedUrl}${
    videoEmbed.embedUrl.includes("?") ? "&" : "?"
  }autoplay=1&playsinline=1&rel=0`;
}

export function parseYouTubeVideoId(
  url: string | null | undefined,
): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") {
    return cleanYouTubeId(parsed.pathname.split("/").filter(Boolean)[0]);
  }

  if (host !== "youtube.com" && host !== "m.youtube.com") return null;

  if (parsed.pathname === "/watch") {
    return cleanYouTubeId(parsed.searchParams.get("v"));
  }

  const [kind, id] = parsed.pathname.split("/").filter(Boolean);
  if (kind === "embed" || kind === "shorts" || kind === "live") {
    return cleanYouTubeId(id);
  }

  return null;
}

function cleanYouTubeId(value: string | null | undefined) {
  if (!value) return null;
  const [id] = value.split(/[?&#]/);
  return id && youtubeIdPattern.test(id) ? id : null;
}
