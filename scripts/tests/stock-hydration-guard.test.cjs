const fs = require("node:fs")
const path = require("node:path")
const assert = require("node:assert/strict")

function read(filePath) {
  return fs.readFileSync(filePath, "utf8")
}

function run() {
  const target = path.join(
    process.cwd(),
    "app",
    "(dashboard)",
    "as",
    "stock",
    "page.tsx",
  )

  const source = read(target)

  assert.ok(
    source.includes("const stockHydratedRef = useRef(false)"),
    "Missing hydration ref guard declaration",
  )
  assert.ok(
    source.includes("stockHydratedRef.current = true"),
    "Missing hydration completion flag",
  )
  assert.ok(
    source.includes("if (!stockHydratedRef.current) return"),
    "Missing write-effect hydration guard",
  )
  assert.ok(
    source.includes("const stockFirstWriteSkippedRef = useRef(false)"),
    "Missing first-write skip ref for stock items",
  )
  assert.ok(
    source.includes("if (!stockFirstWriteSkippedRef.current)"),
    "Missing first-write skip guard for stock items",
  )

  process.stdout.write("PASS stock hydration guard regression test\n")
}

try {
  run()
} catch (error) {
  process.stderr.write(`FAIL stock hydration guard regression test: ${error.message}\n`)
  process.exit(1)
}
