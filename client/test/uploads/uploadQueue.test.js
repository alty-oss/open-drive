import assert from "node:assert/strict";
import test from "node:test";
import {
  entriesFromFileList,
  joinPath,
  parentOf,
} from "../../src/features/uploads/lib/uploadEntries.ts";
import { createUploadItem } from "../../src/features/uploads/model/uploadJob.ts";

test("the queue preserves relative hierarchy and the calculated destination", () => {
  const file = {
    name: "foto.jpg",
    size: 42,
    webkitRelativePath: "album/viagem/foto.jpg",
  };
  const [entry] = entriesFromFileList([file]);
  const destination = joinPath("destino", parentOf(entry.relativePath));
  const item = createUploadItem("upload-1", entry, destination);

  assert.equal(entry.relativePath, "album/viagem/foto.jpg");
  assert.equal(destination, "destino/album/viagem");
  assert.deepEqual(
    {
      id: item.id,
      name: item.name,
      destination: item.destination,
      size: item.size,
      status: item.status,
      progress: item.progress,
    },
    {
      id: "upload-1",
      name: "album/viagem/foto.jpg",
      destination: "destino/album/viagem",
      size: 42,
      status: "waiting",
      progress: 0,
    },
  );
});

test("destination joining does not create extra root separators", () => {
  assert.equal(joinPath("", "folder"), "folder");
  assert.equal(joinPath("meu-drive", ""), "meu-drive");
  assert.equal(parentOf("file.txt"), "");
});
