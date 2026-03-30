#!/usr/bin/env node
/*
One-time migration: import AS localStorage dump into DB APIs.

Usage:
  node scripts/as-one-time-migrate-to-db.cjs --file ./dump.json --base-url https://treatmed-os-v2.vercel.app
*/

const fs = require("fs")
const path = require("path")

function parseArgs(argv) {
  const out = {
    file: "",
    baseUrl: "https://treatmed-os-v2.vercel.app",
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === "--file") out.file = argv[i + 1] || ""
    if (a === "--base-url") out.baseUrl = argv[i + 1] || out.baseUrl
  }
  return out
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function decodeDumpValue(v) {
  if (typeof v !== "string") return v
  return safeJsonParse(v, null)
}

function normalizeArray(v) {
  return Array.isArray(v) ? v : []
}

function mergeById(current, incoming) {
  const a = normalizeArray(current)
  const b = normalizeArray(incoming)
  const map = new Map()
  for (const row of a) {
    if (row && typeof row === "object" && typeof row.id === "string") map.set(row.id, row)
  }
  for (const row of b) {
    if (row && typeof row === "object" && typeof row.id === "string") map.set(row.id, row)
  }
  if (map.size > 0) return Array.from(map.values())
  const uniq = new Set()
  const out = []
  for (const row of [...a, ...b]) {
    const key = JSON.stringify(row)
    if (uniq.has(key)) continue
    uniq.add(key)
    out.push(row)
  }
  return out
}

async function httpJson(url, init) {
  const res = await fetch(url, init)
  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (!res.ok) {
    const err = (body && body.error) || `${res.status} ${res.statusText}`
    throw new Error(`${url} -> ${err}`)
  }
  return body
}

async function migrateOrganizations(baseUrl, dump) {
  const raw = decodeDumpValue(dump.as_organizations)
  const incoming = normalizeArray(raw)
  if (incoming.length === 0) return 0
  const current = await httpJson(`${baseUrl}/api/as/organizations`, { method: "GET" })
  const merged = mergeById(current, incoming)
  await httpJson(`${baseUrl}/api/as/organizations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orgs: merged }),
  })
  return incoming.length
}

async function migrateJobs(baseUrl, dump) {
  const raw = decodeDumpValue(dump.as_service_jobs)
  const incoming = normalizeArray(raw)
  if (incoming.length === 0) return 0
  const current = await httpJson(`${baseUrl}/api/as/jobs`, { method: "GET" })
  const merged = mergeById(current, incoming)
  await httpJson(`${baseUrl}/api/as/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobs: merged }),
  })
  return incoming.length
}

const STATE_KEY_MAP = {
  as_stock_items: "as:stock_items",
  as_stock_transactions: "as:stock_transactions",
  as_stock_bookings: "as:stock_bookings",
  as_stock_dispatches: "as:stock_dispatches",
  as_repair_to_cal_requests: "as:repair_to_cal_requests",
  as_parts_requests: "as:parts_requests",
  as_commissioning_claim_cases: "as:commissioning_claim_cases",
  as_se_incoming_requests: "as:se_incoming_requests",
}

async function migrateStateBlobs(baseUrl, dump) {
  let written = 0
  for (const [localKey, dbKey] of Object.entries(STATE_KEY_MAP)) {
    const incoming = decodeDumpValue(dump[localKey])
    if (incoming === null || incoming === undefined) continue
    const current = await httpJson(`${baseUrl}/api/as/state?key=${encodeURIComponent(dbKey)}`, { method: "GET" })
    const existingPayload = current && Object.prototype.hasOwnProperty.call(current, "payload") ? current.payload : null
    const payload =
      Array.isArray(existingPayload) && Array.isArray(incoming)
        ? mergeById(existingPayload, incoming)
        : incoming
    await httpJson(`${baseUrl}/api/as/state`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: dbKey, payload }),
    })
    written += 1
  }
  return written
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.file) {
    throw new Error("Missing --file <dump.json>")
  }
  const abs = path.resolve(process.cwd(), args.file)
  const raw = fs.readFileSync(abs, "utf-8")
  const dump = safeJsonParse(raw, null)
  if (!dump || typeof dump !== "object") {
    throw new Error("Invalid JSON dump file")
  }

  const baseUrl = args.baseUrl.replace(/\/+$/, "")
  const orgCount = await migrateOrganizations(baseUrl, dump)
  const jobCount = await migrateJobs(baseUrl, dump)
  const blobCount = await migrateStateBlobs(baseUrl, dump)

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        imported: {
          organizations: orgCount,
          jobs: jobCount,
          stateKeysWritten: blobCount,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error("[as-one-time-migrate-to-db] failed:", error.message)
  process.exit(1)
})
