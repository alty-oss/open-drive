import assert from "node:assert/strict";
import test from "node:test";

let parseSubtitleText;
let isSubtitleFileName;

test.before(async () => {
  ({ parseSubtitleText, isSubtitleFileName } = await import(
    "../../src/features/viewer/lib/subtitles.ts"
  ));
});

test("recognizes only SRT and VTT files as subtitles", () => {
  assert.equal(isSubtitleFileName("movie.en-US.srt"), true);
  assert.equal(isSubtitleFileName("SUBTITLE.VTT"), true);
  assert.equal(isSubtitleFileName("subtitle.txt"), false);
  assert.equal(isSubtitleFileName("video.mp4"), false);
});

test("parses SRT, preserves multiple lines, and removes markup", () => {
  const cues = parseSubtitleText(`1
00:00:01,250 --> 00:00:03,500
Hello, <i>OpenDrive</i>.
Second line.

2
00:01:00,000 --> 00:01:02,250
Another subtitle`);

  assert.deepEqual(cues, [
    {
      start: 1.25,
      end: 3.5,
      text: "Hello, OpenDrive.\nSecond line.",
    },
    {
      start: 60,
      end: 62.25,
      text: "Another subtitle",
    },
  ]);
});

test("parses WebVTT with positioning settings", () => {
  const cues = parseSubtitleText(`WEBVTT

00:00.500 --> 00:02.000 align:middle position:50%
Primeira

caption-two
00:02.100 --> 00:04.000
Segunda`);

  assert.deepEqual(cues, [
    { start: 0.5, end: 2, text: "Primeira" },
    { start: 2.1, end: 4, text: "Segunda" },
  ]);
});

test("ignores invalid blocks and orders subtitles by start time", () => {
  const cues = parseSubtitleText(`2
00:00:05,000 --> 00:00:06,000
Depois

invalid
00:00:04,000 --> 00:00:03,000
End before start

1
00:00:01,000 --> 00:00:02,000
Antes`);

  assert.deepEqual(cues, [
    { start: 1, end: 2, text: "Antes" },
    { start: 5, end: 6, text: "Depois" },
  ]);
});
