import { describe, it, expect } from "vitest";
import { FORMATS } from "@/core/domain/format";
import {
  AUDIO_BITRATES,
  AUDIO_BITRATE_OPTION,
  AUDIO_FORMATS,
  AUDIO_TARGETS,
  DEFAULT_AUDIO_BITRATE,
  DEFAULT_GIF_FPS,
  DEFAULT_GIF_WIDTH,
  GIF_OPTIONS,
  MAX_GIF_FPS,
  MIN_GIF_FPS,
  VIDEO_AUDIO_EXTRACT_TARGETS,
  VIDEO_FORMATS,
  VIDEO_TARGETS,
  buildCapabilities,
  buildFfmpegArgs,
  ffmpegFileNames,
  resolveAudioBitrate,
  resolveGifFps,
  resolveGifWidth,
  resolveMediaOptions,
  targetHasBitrateOption,
} from "./ffmpeg-args";

const baseOptions = resolveMediaOptions({});

describe("resolveMediaOptions", () => {
  it("returns defaults for an empty bag", () => {
    expect(baseOptions).toEqual({
      audioBitrate: DEFAULT_AUDIO_BITRATE,
      fps: DEFAULT_GIF_FPS,
      width: DEFAULT_GIF_WIDTH,
    });
  });

  it("reads a valid bitrate string", () => {
    expect(resolveMediaOptions({ audioBitrate: "320k" }).audioBitrate).toBe("320k");
  });

  it("falls back on an unknown bitrate", () => {
    expect(resolveMediaOptions({ audioBitrate: "999k" }).audioBitrate).toBe(DEFAULT_AUDIO_BITRATE);
  });

  it("parses numeric fps/width from strings", () => {
    const resolved = resolveMediaOptions({ fps: "24", width: "640" });
    expect(resolved.fps).toBe(24);
    expect(resolved.width).toBe(640);
  });

  it("clamps and rounds fps/width from numbers", () => {
    const resolved = resolveMediaOptions({ fps: 99.6, width: 320.4 });
    expect(resolved.fps).toBe(MAX_GIF_FPS);
    expect(resolved.width).toBe(320);
  });
});

describe("resolveAudioBitrate", () => {
  it("accepts each supported bitrate", () => {
    for (const b of AUDIO_BITRATES) {
      expect(resolveAudioBitrate(b)).toBe(b);
    }
  });
  it("rejects unsupported values", () => {
    expect(resolveAudioBitrate("64k")).toBe(DEFAULT_AUDIO_BITRATE);
    expect(resolveAudioBitrate("")).toBe(DEFAULT_AUDIO_BITRATE);
  });
});

describe("resolveGifFps", () => {
  it("clamps below min", () => {
    expect(resolveGifFps(0)).toBe(MIN_GIF_FPS);
    expect(resolveGifFps(-5)).toBe(MIN_GIF_FPS);
  });
  it("clamps above max", () => {
    expect(resolveGifFps(120)).toBe(MAX_GIF_FPS);
  });
  it("rounds to integer", () => {
    expect(resolveGifFps(11.7)).toBe(12);
  });
  it("falls back on non-finite", () => {
    expect(resolveGifFps(Number.NaN)).toBe(DEFAULT_GIF_FPS);
    expect(resolveGifFps(Number.POSITIVE_INFINITY)).toBe(DEFAULT_GIF_FPS);
  });
});

describe("resolveGifWidth", () => {
  it("rounds and accepts positive integers", () => {
    expect(resolveGifWidth(800.2)).toBe(800);
  });
  it("falls back on non-positive or non-finite", () => {
    expect(resolveGifWidth(0)).toBe(DEFAULT_GIF_WIDTH);
    expect(resolveGifWidth(-10)).toBe(DEFAULT_GIF_WIDTH);
    expect(resolveGifWidth(Number.NaN)).toBe(DEFAULT_GIF_WIDTH);
  });
});

describe("targetHasBitrateOption", () => {
  it("is true for lossy audio + video targets", () => {
    expect(targetHasBitrateOption(FORMATS.mp3.id)).toBe(true);
    expect(targetHasBitrateOption(FORMATS.ogg.id)).toBe(true);
    expect(targetHasBitrateOption(FORMATS.aac.id)).toBe(true);
    expect(targetHasBitrateOption(FORMATS.mp4.id)).toBe(true);
    expect(targetHasBitrateOption(FORMATS.webm.id)).toBe(true);
  });
  it("is false for wav and gif (no bitrate)", () => {
    expect(targetHasBitrateOption(FORMATS.wav.id)).toBe(false);
    expect(targetHasBitrateOption(FORMATS.gif.id)).toBe(false);
  });
});

describe("ffmpegFileNames", () => {
  it("uses canonical extensions", () => {
    expect(ffmpegFileNames(FORMATS.mp3, FORMATS.wav)).toEqual({
      inputName: "input.mp3",
      outputName: "output.wav",
    });
    expect(ffmpegFileNames(FORMATS.mov, FORMATS.gif)).toEqual({
      inputName: "input.mov",
      outputName: "output.gif",
    });
  });
});

describe("buildFfmpegArgs", () => {
  it("mp3 -> wav uses PCM and drops video, no bitrate flag", () => {
    const args = buildFfmpegArgs("input.mp3", "output.wav", FORMATS.wav.id, baseOptions);
    expect(args).toEqual(["-i", "input.mp3", "-vn", "-c:a", "pcm_s16le", "output.wav"]);
    expect(args).not.toContain("-b:a");
  });

  it("wav -> mp3 honours the chosen bitrate", () => {
    const opts = resolveMediaOptions({ audioBitrate: "320k" });
    const args = buildFfmpegArgs("input.wav", "output.mp3", FORMATS.mp3.id, opts);
    expect(args).toEqual([
      "-i",
      "input.wav",
      "-vn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "320k",
      "output.mp3",
    ]);
  });

  it("defaults the mp3 bitrate to 192k", () => {
    const args = buildFfmpegArgs("input.wav", "output.mp3", FORMATS.mp3.id, baseOptions);
    const idx = args.indexOf("-b:a");
    expect(args[idx + 1]).toBe("192k");
  });

  it("flac -> ogg uses libvorbis with bitrate", () => {
    const opts = resolveMediaOptions({ audioBitrate: "256k" });
    const args = buildFfmpegArgs("input.flac", "output.ogg", FORMATS.ogg.id, opts);
    expect(args).toContain("libvorbis");
    expect(args.slice(-3)).toEqual(["-b:a", "256k", "output.ogg"]);
  });

  it("m4a -> aac uses the aac encoder", () => {
    const args = buildFfmpegArgs("input.m4a", "output.aac", FORMATS.aac.id, baseOptions);
    expect(args).toContain("aac");
    expect(args).toContain("-b:a");
  });

  it("mp4 -> webm picks vp9/opus", () => {
    const args = buildFfmpegArgs("input.mp4", "output.webm", FORMATS.webm.id, baseOptions);
    expect(args).toEqual([
      "-i",
      "input.mp4",
      "-c:v",
      "libvpx-vp9",
      "-c:a",
      "libopus",
      "-b:a",
      "192k",
      "output.webm",
    ]);
  });

  it("avi -> mp4 picks x264/aac", () => {
    const args = buildFfmpegArgs("input.avi", "output.mp4", FORMATS.mp4.id, baseOptions);
    expect(args).toContain("libx264");
    expect(args).toContain("aac");
    expect(args[args.length - 1]).toBe("output.mp4");
  });

  it("mov -> mp3 extracts audio (no video stream)", () => {
    const args = buildFfmpegArgs("input.mov", "output.mp3", FORMATS.mp3.id, baseOptions);
    expect(args).toContain("-vn");
    expect(args).toContain("libmp3lame");
  });

  it("mkv -> wav extracts PCM audio", () => {
    const args = buildFfmpegArgs("input.mkv", "output.wav", FORMATS.wav.id, baseOptions);
    expect(args).toContain("-vn");
    expect(args).toContain("pcm_s16le");
  });

  it("mp4 -> gif builds the fps/scale filter from options", () => {
    const opts = resolveMediaOptions({ fps: 15, width: 320 });
    const args = buildFfmpegArgs("input.mp4", "output.gif", FORMATS.gif.id, opts);
    const filterIdx = args.indexOf("-vf");
    expect(filterIdx).toBeGreaterThanOrEqual(0);
    expect(args[filterIdx + 1]).toBe("fps=15,scale=320:-1:flags=lanczos");
    expect(args[args.length - 1]).toBe("output.gif");
  });

  it("mp4 -> gif uses defaults when options omitted", () => {
    const args = buildFfmpegArgs("input.mp4", "output.gif", FORMATS.gif.id, baseOptions);
    const filterIdx = args.indexOf("-vf");
    expect(args[filterIdx + 1]).toBe(
      `fps=${DEFAULT_GIF_FPS},scale=${DEFAULT_GIF_WIDTH}:-1:flags=lanczos`,
    );
  });

  it("always starts with -i <input> and ends with <output>", () => {
    const args = buildFfmpegArgs("in.x", "out.y", FORMATS.mp3.id, baseOptions);
    expect(args[0]).toBe("-i");
    expect(args[1]).toBe("in.x");
    expect(args[args.length - 1]).toBe("out.y");
  });
});

describe("capability matrix", () => {
  const caps = buildCapabilities();

  it("covers every audio source to every audio target except identity", () => {
    for (const source of AUDIO_FORMATS) {
      for (const target of AUDIO_TARGETS) {
        const found = caps.find((c) => c.source.id === source.id && c.target.id === target.id);
        if (source.id === target.id) {
          expect(found).toBeUndefined();
        } else {
          expect(found).toBeDefined();
        }
      }
    }
  });

  it("covers video->video (non-identity), video->audio-extract and video->gif", () => {
    for (const source of VIDEO_FORMATS) {
      for (const target of VIDEO_TARGETS) {
        const found = caps.find((c) => c.source.id === source.id && c.target.id === target.id);
        if (source.id === target.id) expect(found).toBeUndefined();
        else expect(found).toBeDefined();
      }
      for (const target of VIDEO_AUDIO_EXTRACT_TARGETS) {
        expect(
          caps.find((c) => c.source.id === source.id && c.target.id === target.id),
        ).toBeDefined();
      }
      expect(
        caps.find((c) => c.source.id === source.id && c.target.id === FORMATS.gif.id),
      ).toBeDefined();
    }
  });

  it("never emits an identity capability", () => {
    expect(caps.some((c) => c.source.id === c.target.id)).toBe(false);
  });

  it("attaches the bitrate option to lossy audio/video targets only", () => {
    for (const c of caps) {
      const keys = (c.options ?? []).map((o) => o.key);
      if (c.target.id === FORMATS.gif.id) {
        expect(keys).toEqual(["fps", "width"]);
      } else if (targetHasBitrateOption(c.target.id)) {
        expect(keys).toContain("audioBitrate");
      } else {
        expect(keys).not.toContain("audioBitrate");
      }
    }
  });

  it("matches the expected total count", () => {
    // audio->audio: 6 sources x 4 targets - 4 identities = 20
    // video->video: 5 x 2 - 2 identities = 8
    // video->audio-extract: 5 x 2 = 10
    // video->gif: 5
    expect(caps.length).toBe(20 + 8 + 10 + 5);
  });
});

describe("option descriptors", () => {
  it("bitrate select exposes all four choices with 192k default", () => {
    expect(AUDIO_BITRATE_OPTION.kind).toBe("select");
    if (AUDIO_BITRATE_OPTION.kind === "select") {
      expect(AUDIO_BITRATE_OPTION.default).toBe("192k");
      expect(AUDIO_BITRATE_OPTION.choices.map((c) => c.value)).toEqual([
        "128k",
        "192k",
        "256k",
        "320k",
      ]);
    }
  });

  it("gif options declare fps (1..30) and width number controls", () => {
    const byKey = new Map(GIF_OPTIONS.map((o) => [o.key, o]));
    const fps = byKey.get("fps");
    const width = byKey.get("width");
    expect(fps?.kind).toBe("number");
    if (fps?.kind === "number") {
      expect(fps.default).toBe(DEFAULT_GIF_FPS);
      expect(fps.min).toBe(MIN_GIF_FPS);
      expect(fps.max).toBe(MAX_GIF_FPS);
    }
    expect(width?.kind).toBe("number");
    if (width?.kind === "number") {
      expect(width.default).toBe(DEFAULT_GIF_WIDTH);
    }
  });
});
