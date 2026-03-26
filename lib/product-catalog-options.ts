import type { ASDropdownConfig, ProductCatalogGroup } from "@/lib/mock/as-store"

export function getStockPatternManufacturers(
  productCatalog: ProductCatalogGroup[],
  dropdown: Pick<ASDropdownConfig, "stock_manufacturers">,
): string[] {
  const out = new Set<string>()
  for (const g of productCatalog) {
    const m = g.manufacturer.trim()
    if (m) out.add(m)
  }
  for (const m of dropdown.stock_manufacturers) {
    const t = m.trim()
    if (t) out.add(t)
  }
  return [...out].sort((a, b) => a.localeCompare(b, "th"))
}

export function getStockPatternModelsForManufacturer(
  selectedManufacturer: string,
  productCatalog: ProductCatalogGroup[],
  dropdown: Pick<ASDropdownConfig, "stock_models">,
): string[] {
  if (!selectedManufacturer) return []
  const out = new Set<string>()
  let catalogHit = false
  for (const g of productCatalog) {
    if (g.manufacturer !== selectedManufacturer) continue
    catalogHit = true
    for (const m of g.models) {
      const t = m.trim()
      if (t) out.add(t)
    }
  }
  // Keep Stock behavior: fallback to flat stock_models only when this manufacturer has no catalog models.
  if (!catalogHit || out.size === 0) {
    for (const m of dropdown.stock_models) {
      const t = m.trim()
      if (t) out.add(t)
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b, "th"))
}
