const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const sharp = require("sharp");
const ffmpeg = require("ffmpeg-static");
const { convertFile } = require("../src/main/converter");
const { JobQueue } = require("../src/main/jobs");
const {
  FORMAT_CATEGORIES,
  detectCategory,
} = require("../src/renderer/shared/formats");
const dir = fs.mkdtempSync(path.join(__dirname, "fixtures-"));
after(() => {
  if (
    path.dirname(dir) === __dirname &&
    path.basename(dir).startsWith("fixtures-")
  )
    fs.rmSync(dir, { recursive: true, force: true });
});
const image = path.join(dir, "photo.jpg");
const video = path.join(dir, "clip.mp4");
const audio = path.join(dir, "tone.wav");
test("image metadata, encoding, dimensions, icon sizes and concurrent outputs", async () => {
  await sharp({
    create: { width: 80, height: 40, channels: 3, background: "red" },
  })
    .withMetadata({
      orientation: 6,
      exif: { IFD0: { Artist: "Private marker" } },
    })
    .jpeg()
    .toFile(image);
  const stripped = await convertFile(image, "strip_exif");
  const meta = await sharp(stripped.outputPath).metadata();
  assert.equal(meta.exif, undefined);
  assert.equal(meta.width, 40);
  assert.equal(meta.height, 80);
  for (const format of ["png", "webp", "avif", "tiff", "gif"]) {
    const input = path.join(dir, "source." + format);
    await sharp(image).toFormat(format).toFile(input);
    const result = await convertFile(input, "compress");
    assert.equal(
      (await sharp(result.outputPath).metadata()).format,
      format === "avif" ? "heif" : format,
    );
  }
  for (const item of FORMAT_CATEGORIES.image.formats) {
    const result = await convertFile(image, item.id);
    if (item.id === "ico")
      assert.equal(fs.readFileSync(result.outputPath).readUInt16LE(4), 6);
    else assert.ok((await sharp(result.outputPath).metadata()).width > 0);
  }
  const half = await convertFile(image, "resize_50");
  assert.equal((await sharp(half.outputPath).metadata()).width, 20);
  const simultaneous = await Promise.all([
    convertFile(image, "png"),
    convertFile(image, "png"),
  ]);
  assert.notEqual(simultaneous[0].outputPath, simultaneous[1].outputPath);
  await assert.rejects(convertFile(image, "mp4"), /incompatível/);
  const svg = path.join(dir, "drawing.svg");
  fs.writeFileSync(
    svg,
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>',
  );
  const cleanSvg = await convertFile(svg, "strip_exif");
  assert.equal(path.extname(cleanSvg.outputPath), ".png");
});
test("video and audio operations produce decodable media", async () => {
  execFileSync(ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=64x64:rate=15",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=48000",
    "-t",
    "1",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    video,
  ]);
  execFileSync(ffmpeg, ["-v", "error", "-i", video, "-vn", audio]);
  for (const [category, input] of [
    ["video", video],
    ["audio", audio],
  ]) {
    for (const item of [
      ...FORMAT_CATEGORIES[category].formats,
      ...FORMAT_CATEGORIES[category].tools,
    ]) {
      const result = await convertFile(input, item.id);
      assert.ok(result.newSize > 0, item.id);
      execFileSync(
        ffmpeg,
        ["-v", "error", "-i", result.outputPath, "-f", "null", "-"],
        { stdio: "pipe" },
      );
      if (item.id === "wav") {
        let info;
        try {
          execFileSync(ffmpeg, ["-i", result.outputPath], { stdio: "pipe" });
        } catch (e) {
          info = e.stderr.toString();
        }
        assert.match(info, /pcm_s24le/);
      }
    }
  }
});
test("cancelled or invalid conversions leave no partial files", async () => {
  const bad = path.join(dir, "invalid.png");
  fs.writeFileSync(bad, "invalid");
  const before = fs.readdirSync(dir);
  await assert.rejects(convertFile(bad, "webp"));
  assert.deepEqual(fs.readdirSync(dir), before);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    convertFile(image, "webp", { signal: controller.signal }),
    /cancelada/,
  );
  assert.deepEqual(fs.readdirSync(dir), before);
  const live = new AbortController();
  await assert.rejects(
    convertFile(video, "webm", {
      signal: live.signal,
      onProgress: () => live.abort(),
    }),
  );
  assert.deepEqual(fs.readdirSync(dir), before);
});
test("queue serializes jobs, isolates owners and continues after failure", async () => {
  let active = 0,
    maximum = 0;
  const events = [];
  const queue = new JobQueue(
    async (file) => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      if (file === "bad") throw new Error("broken");
      return { outputPath: file };
    },
    (event) => events.push(event),
  );
  queue.add(["a", "bad", "b"], "png", {}, 1);
  queue.add(["cancel"], "png", {}, 2);
  queue.cancel(2);
  await queue.drain();
  assert.equal(maximum, 1);
  assert.equal(events.filter((e) => e.state === "done").length, 2);
  assert.equal(events.filter((e) => e.state === "error").length, 1);
  assert.equal(events.filter((e) => e.state === "cancelled").length, 1);
  assert.equal(detectCategory("track.aiff"), "audio");
  assert.equal(detectCategory("unknown.exe"), null);
});
