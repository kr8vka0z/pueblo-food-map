import { describe, test, expect } from "vitest";
import { chunkSqlStatements, MAX_COMMAND_SQL_CHARS } from "./sqlChunks";

describe("chunkSqlStatements", () => {
  test("keeps a small run as a single chunk", () => {
    const sql = "INSERT INTO t VALUES(1);\nINSERT INTO t VALUES(2);\n";
    expect(chunkSqlStatements(sql)).toEqual(["INSERT INTO t VALUES(1);\nINSERT INTO t VALUES(2);"]);
  });

  test("loses no statement and reorders nothing when it splits", () => {
    const statements = Array.from({ length: 200 }, (_, i) => `INSERT INTO t VALUES(${i});`);
    const chunks = chunkSqlStatements(statements.join("\n") + "\n", 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("\n").split("\n")).toEqual(statements);
  });

  test("no chunk exceeds the budget", () => {
    // ~45 KB, the real shape of a full run: 107 proposal INSERTs of ~400 chars.
    const statements = Array.from({ length: 107 }, (_, i) => `INSERT INTO change_proposals VALUES('${"x".repeat(400)}', ${i});`);
    const chunks = chunkSqlStatements(statements.join("\n") + "\n");
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_COMMAND_SQL_CHARS);
    }
    // This is the regression this whole module exists for: the un-chunked
    // string is over Windows' 32,767-character command-line limit.
    expect(statements.join("\n").length).toBeGreaterThan(32_767);
  });

  test("drops blank lines rather than emitting empty statements", () => {
    expect(chunkSqlStatements("A;\n\n\nB;\n")).toEqual(["A;\nB;"]);
    expect(chunkSqlStatements("\n\n")).toEqual([]);
  });
});
