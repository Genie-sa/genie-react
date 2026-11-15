import { createRandom, hashString, integerBetween, pickOne, pickSome, type Random } from './random'
import type {
  Category,
  ColorOption,
  ImageAngle,
  Product,
  ProductImage,
  Review,
  Specification,
} from './types'

const CATALOG_SEED = 20_261_115
const PRODUCTS_PER_CATEGORY = 22
const SEED_DATE = Date.UTC(2026, 10, 1)
const DAY_MS = 86_400_000

export const CATEGORIES: readonly Category[] = [
  {
    slug: 'outerwear',
    name: 'Outerwear',
    tagline: 'Shells, parkas and coats for every forecast',
    accentHue: 205,
  },
  {
    slug: 'knitwear',
    name: 'Knitwear',
    tagline: 'Merino, lambswool and cotton knits',
    accentHue: 25,
  },
  {
    slug: 'footwear',
    name: 'Footwear',
    tagline: 'Boots, runners and everyday shoes',
    accentHue: 140,
  },
  {
    slug: 'bags',
    name: 'Bags',
    tagline: 'Carry-alls for the commute and the weekend',
    accentHue: 280,
  },
  { slug: 'home', name: 'Home', tagline: 'Textiles and ceramics for slow mornings', accentHue: 45 },
  {
    slug: 'accessories',
    name: 'Accessories',
    tagline: 'Finishing touches in wool and leather',
    accentHue: 340,
  },
]

const NOUNS: Record<string, readonly string[]> = {
  outerwear: ['Parka', 'Rain Shell', 'Field Jacket', 'Quilted Vest', 'Overcoat', 'Chore Coat'],
  knitwear: [
    'Crewneck',
    'Cardigan',
    'Fisherman Sweater',
    'Merino Polo',
    'Rollneck',
    'Zip Pullover',
  ],
  footwear: ['Trail Runner', 'Chelsea Boot', 'Court Sneaker', 'Loafer', 'Hiking Boot', 'Derby'],
  bags: ['Weekender', 'Tote', 'Messenger', 'Daypack', 'Sling', 'Duffel'],
  home: ['Throw Blanket', 'Linen Pillow', 'Mug Set', 'Candle', 'Towel Set', 'Planter'],
  accessories: ['Beanie', 'Scarf', 'Leather Belt', 'Gloves', 'Cap', 'Wallet'],
}

const NAME_PREFIXES = [
  'Harbor',
  'Alpine',
  'Northwind',
  'Cedar',
  'Meridian',
  'Fjord',
  'Atlas',
  'Summit',
  'Tidal',
  'Ember',
  'Juniper',
  'Halden',
  'Lark',
  'Basalt',
  'Solstice',
  'Drift',
  'Kestrel',
  'Marlow',
  'Orchard',
  'Willow',
] as const

const BRANDS = ['Fernhill', 'Oak & Ore', 'Lumen Supply', 'Northbound', 'Common Thread'] as const

const PALETTE: readonly ColorOption[] = [
  { name: 'Charcoal', hex: '#3b4249' },
  { name: 'Oat', hex: '#d8ccb4' },
  { name: 'Forest', hex: '#2f5d46' },
  { name: 'Rust', hex: '#a4502c' },
  { name: 'Navy', hex: '#24345c' },
  { name: 'Sand', hex: '#c9b28a' },
  { name: 'Slate', hex: '#6b7a8a' },
  { name: 'Plum', hex: '#5e3552' },
  { name: 'Ivory', hex: '#efe9dc' },
  { name: 'Olive', hex: '#6b6b3a' },
]

const SIZES: Record<string, readonly string[]> = {
  outerwear: ['XS', 'S', 'M', 'L', 'XL'],
  knitwear: ['XS', 'S', 'M', 'L', 'XL'],
  footwear: ['38', '39', '40', '41', '42', '43', '44', '45'],
  bags: ['One size'],
  home: ['One size'],
  accessories: ['One size'],
}

const PRICE_RANGES: Record<string, readonly [number, number]> = {
  outerwear: [140, 420],
  knitwear: [70, 190],
  footwear: [90, 260],
  bags: [60, 320],
  home: [25, 160],
  accessories: [20, 110],
}

const MATERIALS: Record<string, readonly string[]> = {
  outerwear: ['Recycled nylon ripstop', 'Waxed organic cotton', 'Boiled wool', 'Three-layer shell'],
  knitwear: ['Extra-fine merino', 'Lambswool', 'Organic cotton', 'Merino and cashmere blend'],
  footwear: ['Full-grain leather', 'Suede', 'Recycled mesh', 'Waxed canvas'],
  bags: ['Waxed canvas', 'Vegetable-tanned leather', 'Recycled nylon', 'Cotton duck'],
  home: ['Stonewashed linen', 'Stoneware', 'Soy wax', 'Turkish cotton'],
  accessories: ['Lambswool', 'Bridle leather', 'Merino', 'Brushed cotton'],
}

const ANGLES: readonly ImageAngle[] = ['front', 'back', 'detail', 'lifestyle']
const PATTERNS: readonly ProductImage['pattern'][] = ['stripes', 'dots', 'grid', 'waves']

const REVIEW_AUTHORS = [
  'Maja K.',
  'Jonas P.',
  'Priya S.',
  'Leo M.',
  'Hana T.',
  'Omar R.',
  'Ines D.',
  'Sam W.',
  'Yuki A.',
  'Elena V.',
  'Theo B.',
  'Nadia F.',
]

const REVIEW_TITLES: Record<number, readonly string[]> = {
  5: ['Exactly what I hoped for', 'Worth every penny', 'My new favourite', 'Superb quality'],
  4: ['Very good, minor quibbles', 'Great value', 'Solid and well made', 'Happy with it'],
  3: ['Fine, not amazing', 'Runs a bit small', 'Decent but pricey', 'Mixed feelings'],
  2: ['Not for me', 'Colour differs from photos', 'Seams came loose'],
  1: ['Disappointed', 'Returned it'],
}

const REVIEW_BODIES = [
  'The fabric feels substantial and the stitching is neat. I have worn it most days since it arrived.',
  'Sizing matched the guide. Delivery was quick and the packaging was plastic-free.',
  'Lovely colour in daylight, slightly darker indoors than the product photos suggest.',
  'Comfortable straight away. I would buy another colour if it came back in stock.',
  'Good for the price, although the finish on the hardware could be better.',
  'It took a week to break in, and now it is the thing I reach for first.',
  'Customer service swapped the size for me without any fuss.',
  'Not as warm as I expected for winter, but perfect for autumn evenings.',
]

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function roundPrice(random: Random, [min, max]: readonly [number, number]): number {
  return (integerBetween(random, min, max) - 0.01) * 100
}

function buildImages(
  random: Random,
  productId: string,
  colors: readonly ColorOption[],
  baseHue: number,
): ProductImage[] {
  return colors.flatMap((color, colorIndex) =>
    ANGLES.map((angle, angleIndex) => ({
      id: `${productId}-${slugify(color.name)}-${angle}`,
      color: color.name,
      angle,
      hue: (baseHue + colorIndex * 37 + angleIndex * 11) % 360,
      pattern: pickOne(random, PATTERNS),
    })),
  )
}

function buildSpecifications(random: Random, category: Category, id: string): Specification[] {
  return [
    { label: 'Material', value: pickOne(random, MATERIALS[category.slug] ?? []) },
    { label: 'Weight', value: `${integerBetween(random, 180, 1400)} g` },
    { label: 'Fit', value: pickOne(random, ['Relaxed', 'Regular', 'Tailored']) },
    {
      label: 'Made in',
      value: pickOne(random, ['Portugal', 'Scotland', 'Japan', 'Italy', 'Peru']),
    },
    { label: 'Product code', value: id.toUpperCase() },
  ]
}

function buildDescription(random: Random, name: string, material: string): string[] {
  return [
    `The ${name} is cut from ${material.toLowerCase()} and finished by a small workshop we have partnered with since 2019.`,
    pickOne(random, [
      'Reinforced seams and replaceable parts mean it is built to be repaired rather than replaced.',
      'Every batch is dyed in small runs, so each piece carries slight variations in tone.',
      'Designed in our studio and tested through a full winter by our team before release.',
    ]),
    'Free returns within 30 days. Repairs are free for the first two years.',
  ]
}

interface SeededCatalog {
  products: Product[]
  retiredIds: Set<string>
}

export function seedCatalog(): SeededCatalog {
  const random = createRandom(CATALOG_SEED)
  const generated: Product[] = []

  for (const category of CATEGORIES) {
    const nouns = NOUNS[category.slug] ?? []
    const sizes = SIZES[category.slug] ?? ['One size']
    for (let index = 0; index < PRODUCTS_PER_CATEGORY; index += 1) {
      const id = `${category.slug}-${String(index + 1).padStart(3, '0')}`
      const name = `${NAME_PREFIXES[(index * 7 + category.accentHue) % NAME_PREFIXES.length]} ${nouns[index % nouns.length]}`
      const colors = pickSome(random, PALETTE, integerBetween(random, 1, 4))
      const priceCents = roundPrice(random, PRICE_RANGES[category.slug] ?? [20, 200])
      const onSale = random() < 0.22
      const specifications = buildSpecifications(random, category, id)
      const material = specifications[0]?.value ?? 'Cotton'
      generated.push({
        id,
        slug: `${slugify(name)}-${index + 1}`,
        name,
        brand: pickOne(random, BRANDS),
        categorySlug: category.slug,
        description: buildDescription(random, name, material),
        priceCents,
        compareAtCents: onSale ? Math.round((priceCents * 1.3) / 100) * 100 - 1 : null,
        rating: Math.round((3.4 + random() * 1.6) * 10) / 10,
        reviewCount: integerBetween(random, 4, 64),
        colors,
        sizes: [...sizes],
        variants: colors.flatMap((color) =>
          sizes.map((size) => ({
            id: `${id}-${slugify(color.name)}-${slugify(size)}`,
            color: color.name,
            size,
            stock: random() < 0.12 ? 0 : integerBetween(random, 1, 14),
          })),
        ),
        images: buildImages(random, id, colors, category.accentHue),
        specifications,
        care: [
          pickOne(random, ['Machine wash cold', 'Hand wash only', 'Spot clean', 'Dry clean only']),
          pickOne(random, ['Dry flat', 'Line dry', 'Tumble dry low']),
          'Do not bleach',
        ],
        tags: pickSome(random, ['new', 'bestseller', 'limited', 'organic', 'repairable'], 2),
        addedAt: new Date(SEED_DATE - integerBetween(random, 0, 240) * DAY_MS).toISOString(),
        relatedIds: [],
      })
    }
  }

  for (const product of generated) {
    const sameCategory = generated.filter(
      (candidate) => candidate.categorySlug === product.categorySlug && candidate.id !== product.id,
    )
    product.relatedIds = pickSome(random, sameCategory, 4).map((candidate) => candidate.id)
  }

  const retiredIds = new Set(
    generated
      .filter((product) => product.categorySlug === 'bags')
      .slice(-6)
      .map((product) => product.id),
  )

  return { products: generated.filter((product) => !retiredIds.has(product.id)), retiredIds }
}

export function seedReviews(product: Product): Review[] {
  const random = createRandom(CATALOG_SEED ^ hashString(product.id))
  const count = Math.min(product.reviewCount, 36)
  return Array.from({ length: count }, (_, index) => {
    const rating = Math.max(1, Math.min(5, Math.round(product.rating + (random() - 0.5) * 3)))
    return {
      id: `${product.id}-review-${index + 1}`,
      productId: product.id,
      author: pickOne(random, REVIEW_AUTHORS),
      rating,
      title: pickOne(random, REVIEW_TITLES[rating] ?? REVIEW_TITLES[3] ?? []),
      body: pickOne(random, REVIEW_BODIES),
      createdAt: new Date(SEED_DATE - integerBetween(random, 1, 300) * DAY_MS).toISOString(),
      helpfulCount: integerBetween(random, 0, 40),
    }
  })
}
