/**
 * ชุด label สำหรับ SN หลัก + component ตาม Product Model (รับเข้า Stock / Claim แยก module-sensor)
 */
export function getReceiveModuleSpec(model: string): {
  mainLabel: string
  componentLabels: string[]
} {
  const m = model.trim()
  if (/IDA6/i.test(m)) {
    return {
      mainLabel: "Serial จอ (Display)",
      componentLabels: ["Module 1", "Module 2", "Module 3", "Module 4"],
    }
  }
  if (/X2\s*Solo/i.test(m)) {
    return {
      mainLabel: "Serial เครื่องหลัก (X2 Solo)",
      componentLabels: ["R/F Sensor"],
    }
  }
  if (/X2/i.test(m)) {
    return {
      mainLabel: "Serial เครื่องหลัก (X2)",
      componentLabels: ["R/F Sensor", "CT Sensor", "Light Sensor", "MAM Sensor", "Survey Sensor"],
    }
  }
  if (/ProSim8P?\s*\+\s*SPOT/i.test(m)) {
    return { mainLabel: "Serial เครื่องหลัก", componentLabels: ["SPOT Module"] }
  }
  if (/ProSim4\s*\+\s*SPOTLIGHT/i.test(m)) {
    return { mainLabel: "Serial เครื่องหลัก", componentLabels: ["SPOTLIGHT"] }
  }
  return { mainLabel: "Serial เครื่องหลัก", componentLabels: [] }
}

/** แยก label สำหรับ Claim แบบ Module (IDA6 / SPOT / SPOTLIGHT) */
export function filterModuleClaimLabels(labels: string[]): string[] {
  return labels.filter((l) => /module/i.test(l) || /SPOTLIGHT/i.test(l))
}

/** แยก label สำหรับ Claim แบบ Sensor (X2 / X2 Solo) */
export function filterSensorClaimLabels(labels: string[]): string[] {
  return labels.filter((l) => /sensor/i.test(l))
}
