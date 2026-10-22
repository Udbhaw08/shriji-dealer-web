/**
 * Universal video parser utility for Hero Banners & CMS Content
 * Supports YouTube, Vimeo, Google Drive, direct video files (MP4/WebM/MOV), and uploaded assets.
 */

export function parseVideoUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1. YouTube
  // Matches: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID, etc.
  const ytRegex = /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
  const ytMatch = trimmed.match(ytRegex);
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return {
      type: "youtube",
      provider: "YouTube",
      id: videoId,
      // Autoplay muted in loop with controls enabled
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&playsinline=1&controls=1&rel=0&modestbranding=1`,
      // Unmuted embed for dedicated modal or manual play
      soundEmbedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&playsinline=1&controls=1&rel=0`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      maxResThumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      raw: trimmed,
    };
  }

  // 2. Vimeo
  const vimeoRegex = /(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^/]*\/videos\/|album\/\d+\/video\/|video\/|)(\d+))/i;
  const vimeoMatch = trimmed.match(vimeoRegex);
  if (vimeoMatch && vimeoMatch[1]) {
    const videoId = vimeoMatch[1];
    return {
      type: "vimeo",
      provider: "Vimeo",
      id: videoId,
      embedUrl: `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=1&loop=1&playsinline=1&autopause=0`,
      soundEmbedUrl: `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=0&playsinline=1`,
      watchUrl: `https://vimeo.com/${videoId}`,
      thumbnail: null,
      raw: trimmed,
    };
  }

  // 3. Google Drive
  if (trimmed.includes("drive.google.com")) {
    const driveMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      const fileId = driveMatch[1];
      return {
        type: "drive",
        provider: "Google Drive",
        id: fileId,
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        soundEmbedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        watchUrl: `https://drive.google.com/file/d/${fileId}/view`,
        thumbnail: null,
        raw: trimmed,
      };
    }
  }

  // 4. Direct video file (MP4, WebM, OGG, MOV, or internal /uploads/ path)
  const isDirect =
    /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(trimmed) ||
    trimmed.startsWith("/uploads/") ||
    trimmed.includes("/api/uploads");

  if (isDirect) {
    return {
      type: "direct",
      provider: "Direct Video",
      id: trimmed,
      src: trimmed,
      embedUrl: null,
      soundEmbedUrl: null,
      watchUrl: trimmed,
      thumbnail: null,
      raw: trimmed,
    };
  }

  // 5. Generic HTTP / HTTPS video fallback
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return {
      type: "generic",
      provider: "Web Video",
      id: trimmed,
      src: trimmed,
      embedUrl: trimmed,
      soundEmbedUrl: trimmed,
      watchUrl: trimmed,
      thumbnail: null,
      raw: trimmed,
    };
  }

  return null;
}

export function getVideoBadgeLabel(parsed) {
  if (!parsed) return null;
  switch (parsed.type) {
    case "youtube":
      return "YouTube";
    case "vimeo":
      return "Vimeo";
    case "drive":
      return "Drive Video";
    case "direct":
      return "MP4 / WebM";
    default:
      return "Video";
  }
}
