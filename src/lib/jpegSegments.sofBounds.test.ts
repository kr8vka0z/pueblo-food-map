/**
 * SOF bounds regression test: readJpegDimensions must read height/width only
 * from inside the SOF segment's declared length. A crafted too-short SOF used
 * to borrow the next segment's bytes as its size and pass the photo size check.
 */

import { describe, expect, test } from "vitest";
import { InvalidJpegError, readJpegDimensions } from "@/lib/jpegSegments";
import { segment } from "@/lib/eventFlyers.testutil";

describe("readJpegDimensions — SOF bounded by its own segment", () => {
  test("throws InvalidJpegError when the SOF segment is too short to hold height and width", () => {
    // A 2-byte-payload SOF0 followed by a real SOS: height/width would come from the SOS header.
    const shortSof = new Uint8Array([0xff, 0xd8, ...segment(0xc0, [8, 0]), ...segment(0xda, [1, 1, 0, 0, 63, 0]), 0x12, 0xff, 0xd9]);
    expect(() => readJpegDimensions(shortSof.buffer as ArrayBuffer)).toThrow(InvalidJpegError);
  });
});
