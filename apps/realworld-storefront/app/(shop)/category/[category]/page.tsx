import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { ActiveFilters } from '../../../../components/catalog/active-filters'
import { CatalogResults } from '../../../../components/catalog/catalog-results'
import { FilterPanel } from '../../../../components/catalog/filter-panel'
import { Pagination } from '../../../../components/catalog/pagination'
import { ProductGrid } from '../../../../components/catalog/product-grid'
import { SortControl } from '../../../../components/catalog/sort-control'
import { parseCatalogQuery, type SearchParams } from '../../../../lib/catalog-params'
import { findCategory, listCatalog } from '../../../../lib/data/catalog'

interface CategoryPageProps {
  params: Promise<{ category: string }>
  searchParams: Promise<SearchParams>
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  return { title: findCategory((await params).category)?.name ?? 'Category' }
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps): Promise<ReactNode> {
  const category = findCategory((await params).category)
  if (!category) notFound()
  const query = parseCatalogQuery(category.slug, await searchParams)
  const catalog = await listCatalog(query)

  return (
    <div className="catalog">
      <header className="page-heading">
        <div>
          <h1>{category.name}</h1>
          <p className="muted">{category.tagline}</p>
        </div>
        <SortControl query={query} />
      </header>
      <ActiveFilters query={query} />
      <div className="catalog-body">
        <FilterPanel
          query={query}
          colors={catalog.availableColors}
          sizes={catalog.availableSizes}
        />
        <CatalogResults total={catalog.total}>
          <ProductGrid products={catalog.products} />
          <Pagination query={query} pageCount={catalog.pageCount} />
        </CatalogResults>
      </div>
    </div>
  )
}
