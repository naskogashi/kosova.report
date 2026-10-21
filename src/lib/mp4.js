// Reads the structure of an MP4 file without decoding it: its duration, each track's type and
// codec, and whether it carries a recorded location. The server uses it to check citizen videos
// (one H.264 video track, no audio, at most 5 seconds). Every box length is bounds-checked and
// a malformed file throws.
const malformed = () => new Error("Malformed MP4");

function* boxes(view, start, end) {
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset),
      header = 8;
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7),
    );
    if (size === 1) {
      if (offset + 16 > end) throw malformed();
      const large = view.getBigUint64(offset + 8);
      if (large > BigInt(end - offset)) throw malformed();
      size = Number(large);
      header = 16;
    } else if (size === 0) size = end - offset;
    if (size < header || offset + size > end) throw malformed();
    yield { type, start: offset + header, end: offset + size };
    offset += size;
  }
  if (offset !== end) throw malformed();
}

const child = (view, box, type) => [...boxes(view, box.start, box.end)].find((b) => b.type === type);

// mvhd and mdhd share the layout: version 1 uses 64-bit times and duration.
function seconds(view, box) {
  const version = view.getUint8(box.start);
  const at = box.start + (version === 1 ? 20 : 12);
  if (at + (version === 1 ? 12 : 8) > box.end) throw malformed();
  const timescale = view.getUint32(at);
  const duration = version === 1 ? Number(view.getBigUint64(at + 4)) : view.getUint32(at + 4);
  if (!timescale) throw malformed();
  return duration / timescale;
}

function fourCC(view, at, end) {
  if (at + 4 > end) throw malformed();
  return String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
}

// "©xyz" (QuickTime), "loci" (3GPP) and Apple's ISO 6709 key all hold a GPS position.
const LOCATION = ["\xA9xyz", "loci", "location.ISO6709"].map((text) => Uint8Array.from(text, (c) => c.charCodeAt(0)));
function hasLocation(bytes) {
  return LOCATION.some((needle) => {
    outer: for (let i = 0; i + needle.length <= bytes.length; i++) {
      for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
      return true;
    }
    return false;
  });
}

export function inspectMp4(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const top = [...boxes(view, 0, view.byteLength)];
  const moov = top.find((box) => box.type === "moov");
  if (top[0]?.type !== "ftyp" || !moov || !top.some((box) => box.type === "mdat")) throw malformed();
  const mvhd = child(view, moov, "mvhd");
  if (!mvhd) throw malformed();
  let duration = seconds(view, mvhd);
  const tracks = [];
  for (const trak of boxes(view, moov.start, moov.end)) {
    if (trak.type !== "trak") continue;
    const mdia = child(view, trak, "mdia");
    const mdhd = mdia && child(view, mdia, "mdhd");
    const hdlr = mdia && child(view, mdia, "hdlr");
    const minf = mdia && child(view, mdia, "minf");
    const stbl = minf && child(view, minf, "stbl");
    const stsd = stbl && child(view, stbl, "stsd");
    if (!mdhd || !hdlr || !stsd) throw malformed();
    const track = {
      handler: fourCC(view, hdlr.start + 8, hdlr.end),
      // stsd: version/flags, entry count, then the first sample entry's size and type.
      codec: fourCC(view, stsd.start + 12, stsd.end),
      duration: seconds(view, mdhd),
    };
    duration = Math.max(duration, track.duration);
    tracks.push(track);
  }
  return { duration, tracks, location: hasLocation(bytes.subarray(moov.start, moov.end)) };
}
