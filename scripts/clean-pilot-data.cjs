#!/usr/bin/env node
require("dotenv").config({ path: ".env.local" })
const { Client } = require("pg")

function hasFlag(name) {
  return process.argv.includes(name)
}

async function main() {
  const force = hasFlag("--yes")
  const includeSettings = hasFlag("--include-settings")
  if (!force) {
    throw new Error("Refusing to run without --yes (destructive operation)")
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in environment")
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query("BEGIN")
  try {
    const runtimeTables = [
      "as_contacts",
      "as_organizations",
      "as_parts_requests",
      "as_proactive_calibration_assets",
      "as_service_jobs",
      "as_stock_bookings",
      "as_stock_dispatches",
      "as_stock_items",
      "as_stock_transactions",
      "app_state_blobs",
      "se_deal_activities",
      "se_deals",
      "se_order_requests",
      "se_service_requests",
    ]
    await client.query(`TRUNCATE TABLE ${runtimeTables.join(", ")} RESTART IDENTITY CASCADE`)

    if (includeSettings) {
      const settingsTables = [
        "as_dropdown_config",
        "as_workflow_settings",
        "global_settings",
        "kpi_settings",
        "se_settings",
      ]
      await client.query(`TRUNCATE TABLE ${settingsTables.join(", ")} RESTART IDENTITY CASCADE`)
    }

    await client.query("COMMIT")
    console.log(
      JSON.stringify(
        {
          ok: true,
          includeSettings,
          cleared: includeSettings ? "runtime+settings" : "runtime-only",
        },
        null,
        2,
      ),
    )
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error("[clean-pilot-data] failed:", err.message)
  process.exit(1)
})
