import test from "node:test";
import assert from "node:assert/strict";
import { parseVideoUrl, getVideoBadgeLabel } from "../utils/video.js";

test("YouTube URL parsing - standard watch URL", () => {
  const result = parseVideoUrl("https://www.youtube.com/watch?v=_0qJvMkuG2E");
  assert.equal(result?.type, "youtube");
  assert.equal(result?.id, "_0qJvMkuG2E");
  assert.match(result.embedUrl, /_0qJvMkuG2E/);
  assert.match(result.embedUrl, /autoplay=1/);
  assert.match(result.embedUrl, /mute=1/);
  assert.equal(result.thumbnail, "https://img.youtube.com/vi/_0qJvMkuG2E/hqdefault.jpg");
  assert.equal(getVideoBadgeLabel(result), "YouTube");
});

test("YouTube URL parsing - youtu.be short URL", () => {
  const result = parseVideoUrl("https://youtu.be/_0qJvMkuG2E?si=xyz123");
  assert.equal(result?.type, "youtube");
  assert.equal(result?.id, "_0qJvMkuG2E");
});

test("YouTube URL parsing - shorts URL", () => {
  const result = parseVideoUrl("https://www.youtube.com/shorts/_0qJvMkuG2E");
  assert.equal(result?.type, "youtube");
  assert.equal(result?.id, "_0qJvMkuG2E");
});

test("Vimeo URL parsing", () => {
  const result = parseVideoUrl("https://vimeo.com/76979871");
  assert.equal(result?.type, "vimeo");
  assert.equal(result?.id, "76979871");
  assert.equal(getVideoBadgeLabel(result), "Vimeo");
});

test("Google Drive video URL parsing", () => {
  const result = parseVideoUrl("https://drive.google.com/file/d/1B6mY2tM_demo_banner/view?usp=sharing");
  assert.equal(result?.type, "drive");
  assert.equal(result?.id, "1B6mY2tM_demo_banner");
  assert.equal(result.embedUrl, "https://drive.google.com/file/d/1B6mY2tM_demo_banner/preview");
  assert.equal(getVideoBadgeLabel(result), "Drive Video");
});

test("Direct MP4 and upload file video parsing", () => {
  const direct = parseVideoUrl("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
  assert.equal(direct?.type, "direct");
  assert.equal(getVideoBadgeLabel(direct), "MP4 / WebM");

  const upload = parseVideoUrl("/uploads/hero-banners/clip-12345.mp4");
  assert.equal(upload?.type, "direct");
});

test("Empty or invalid video URL returns null gracefully", () => {
  assert.equal(parseVideoUrl(""), null);
  assert.equal(parseVideoUrl(null), null);
  assert.equal(parseVideoUrl(undefined), null);
});
