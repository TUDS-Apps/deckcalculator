// shopifyService.js - Shopify Storefront API Service
// Handles fetching products, prices, and cart functionality

import { SHOPIFY_CONFIG, SHOPIFY_GRAPHQL_URL } from './shopifyConfig.js';

// --- Cache Management ---
let productCache = null;
let cacheTimestamp = null;
let productMapBySku = new Map();
let productMapByHandle = new Map();

// --- GraphQL Queries ---

// Fetch all products with their variants and prices
const PRODUCTS_QUERY = `
  query GetAllProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          availableForSale
          tags
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                availableForSale
                quantityAvailable
                price {
                  amount
                  currencyCode
                }
                compareAtPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Create cart mutation (replaces deprecated checkoutCreate)
const CREATE_CART_MUTATION = `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

// --- API Helper Functions ---

/**
 * Execute a GraphQL query against the Shopify Storefront API
 */
async function executeQuery(query, variables = {}) {
  if (!SHOPIFY_CONFIG.enabled) {
    throw new Error('Shopify integration is disabled');
  }

  const response = await fetch(SHOPIFY_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_CONFIG.storefrontAccessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.errors) {
    console.error('Shopify GraphQL errors:', data.errors);
    throw new Error(`GraphQL error: ${data.errors[0]?.message || 'Unknown error'}`);
  }

  return data.data;
}

/**
 * Fetch all products from Shopify (handles pagination)
 */
async function fetchAllProducts() {
  const allProducts = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const variables = { first: 250 }; // Max 250 per request
    if (cursor) variables.after = cursor;

    const data = await executeQuery(PRODUCTS_QUERY, variables);
    const products = data.products.edges.map(edge => edge.node);
    allProducts.push(...products);

    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;
  }

  return allProducts;
}

/**
 * Determine shipping type from product tags
 * @param {Array} tags - Array of product tag strings
 * @returns {string} 'standard', 'oversized', 'ltl', or 'unknown'
 */
function getShippingType(tags) {
  if (!tags || tags.length === 0) return 'unknown';
  const lowerTags = tags.map(t => t.toLowerCase());
  if (lowerTags.includes('standard')) return 'standard';
  if (lowerTags.includes('oversized')) return 'oversized';
  if (lowerTags.includes('ltl')) return 'ltl';
  return 'unknown';
}

/**
 * Build lookup maps from products array
 */
function buildProductMaps(products) {
  productMapBySku.clear();
  productMapByHandle.clear();

  for (const product of products) {
    productMapByHandle.set(product.handle, product);
    const tags = product.tags || [];
    const shippingType = getShippingType(tags);

    for (const variantEdge of product.variants.edges) {
      const variant = variantEdge.node;
      if (variant.sku) {
        productMapBySku.set(variant.sku, {
          product,
          variant,
          price: parseFloat(variant.price.amount),
          compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice.amount) : null,
          available: variant.availableForSale,
          quantityAvailable: variant.quantityAvailable,
          tags,
          shippingType
        });
      }
    }
  }
}

// --- Public API Functions ---

/**
 * Load and cache all products from Shopify
 * Call this on app initialization
 */
export async function loadShopifyProducts() {
  // Check cache validity
  if (productCache && cacheTimestamp && (Date.now() - cacheTimestamp < SHOPIFY_CONFIG.cacheDuration)) {
    console.log('Using cached Shopify products');
    return productCache;
  }

  try {
    console.log('Fetching products from Shopify...');
    const products = await fetchAllProducts();

    productCache = products;
    cacheTimestamp = Date.now();
    buildProductMaps(products);

    console.log(`Loaded ${products.length} products from Shopify`);
    console.log(`SKU map has ${productMapBySku.size} entries`);

    return products;
  } catch (error) {
    console.error('Error loading Shopify products:', error);
    throw error;
  }
}

/**
 * Get product/variant info by SKU
 * @param {string} sku - The SKU to look up (typically matches system_id)
 * @returns {object|null} Product info including price, or null if not found
 */
export function getProductBySku(sku) {
  return productMapBySku.get(sku) || null;
}

/**
 * Get product by handle (URL slug)
 * @param {string} handle - The product handle
 * @returns {object|null} Product object or null
 */
export function getProductByHandle(handle) {
  return productMapByHandle.get(handle) || null;
}

/**
 * Get live price for a SKU
 * @param {string} sku - The SKU to look up
 * @returns {number|null} Price as a number, or null if not found
 */
export function getPriceBySku(sku) {
  const productInfo = productMapBySku.get(sku);
  return productInfo ? productInfo.price : null;
}

/**
 * Check if a SKU is in stock
 * @param {string} sku - The SKU to check
 * @returns {boolean} True if available for sale
 */
export function isInStock(sku) {
  const productInfo = productMapBySku.get(sku);
  return productInfo ? productInfo.available : false;
}

/**
 * Get all loaded products
 * @returns {Array} Array of all products
 */
export function getAllProducts() {
  return productCache || [];
}

/**
 * Get all SKUs that are mapped
 * @returns {Array} Array of SKU strings
 */
export function getAllSkus() {
  return Array.from(productMapBySku.keys());
}

/**
 * Check if Shopify products are loaded
 * @returns {boolean}
 */
export function isLoaded() {
  return productCache !== null && productCache.length > 0;
}

/**
 * Clear the product cache (forces refresh on next load)
 */
export function clearCache() {
  productCache = null;
  cacheTimestamp = null;
  productMapBySku.clear();
  productMapByHandle.clear();
}

/**
 * Create a Shopify cart with BOM items
 * @param {Array} bomItems - Array of BOM items with system_id and qty
 * @returns {object} Cart info including checkoutUrl
 */
export async function createCheckout(bomItems) {
  const lines = [];

  for (const item of bomItems) {
    // Try to find variant by system_id (used as SKU)
    const productInfo = productMapBySku.get(item.system_id);

    if (productInfo && productInfo.variant && productInfo.available) {
      lines.push({
        merchandiseId: productInfo.variant.id,
        quantity: item.qty
      });
    } else {
      console.warn(`SKU ${item.system_id} not found or unavailable in Shopify`);
    }
  }

  if (lines.length === 0) {
    throw new Error('No valid items to add to cart');
  }

  const input = { lines };
  const data = await executeQuery(CREATE_CART_MUTATION, { input });

  if (data.cartCreate.userErrors && data.cartCreate.userErrors.length > 0) {
    const errors = data.cartCreate.userErrors;
    throw new Error(`Cart error: ${errors[0].message}`);
  }

  // Return in compatible format (webUrl for backwards compatibility)
  return {
    id: data.cartCreate.cart.id,
    webUrl: data.cartCreate.cart.checkoutUrl,
    totalPrice: data.cartCreate.cart.cost.totalAmount
  };
}

/**
 * Update BOM items with live Shopify prices
 * @param {Array} bomItems - Array of BOM items
 * @returns {Array} BOM items with updated prices and availability
 */
export function enrichBomWithShopifyData(bomItems) {
  if (!isLoaded()) {
    console.warn('Shopify products not loaded, returning original BOM');
    return bomItems;
  }

  return bomItems.map(item => {
    // The system_id should be stored somewhere in the item
    // We need to pass it through from the BOM calculation
    const sku = item.system_id || item._system_id;

    if (!sku) {
      return { ...item, shopifyStatus: 'no_sku' };
    }

    const shopifyData = productMapBySku.get(sku);

    if (!shopifyData) {
      return { ...item, shopifyStatus: 'not_found' };
    }

    return {
      ...item,
      shopifyPrice: shopifyData.price,
      shopifyAvailable: shopifyData.available,
      shopifyQuantityAvailable: shopifyData.quantityAvailable,
      shopifyVariantId: shopifyData.variant.id,
      shopifyProductTitle: shopifyData.product.title,
      shopifyStatus: shopifyData.available ? 'available' : 'out_of_stock',
      shopifyTags: shopifyData.tags || [],
      shippingType: shopifyData.shippingType || 'unknown',
      // Optionally override the local price with Shopify price
      unitPrice: shopifyData.price,
      totalPrice: item.qty * shopifyData.price
    };
  });
}

/**
 * Get price sync status - compare local prices to Shopify
 * Useful for debugging and auditing
 */
export function getPriceSyncStatus(localStockData) {
  if (!isLoaded()) {
    return { status: 'not_loaded', items: [] };
  }

  const results = [];

  for (const item of localStockData) {
    const sku = item.system_id;
    const shopifyData = productMapBySku.get(sku);

    results.push({
      sku,
      item: item.item,
      localPrice: item.retail_price,
      shopifyPrice: shopifyData?.price || null,
      inShopify: !!shopifyData,
      priceDiff: shopifyData ? (shopifyData.price - item.retail_price).toFixed(2) : null,
      available: shopifyData?.available || false
    });
  }

  const matched = results.filter(r => r.inShopify).length;
  const mismatched = results.filter(r => r.inShopify && Math.abs(parseFloat(r.priceDiff)) > 0.01).length;

  return {
    status: 'loaded',
    totalLocal: localStockData.length,
    matchedInShopify: matched,
    priceMismatches: mismatched,
    items: results
  };
}

// --- Debug Functions (exposed globally for troubleshooting) ---

/**
 * Debug: Show all Shopify SKUs and sample local system_ids
 * Call from browser console: window.debugShopifySkus()
 */
window.debugShopifySkus = function() {
  const shopifySkus = getAllSkus();
  const localIds = window.appState?.bom?.map(item => item.system_id).filter(Boolean) || [];

  console.log('=== SHOPIFY SKU DEBUG ===');
  console.log(`Shopify products loaded: ${isLoaded()}`);
  console.log(`Total Shopify SKUs: ${shopifySkus.length}`);
  console.log(`Sample Shopify SKUs (first 10):`, shopifySkus.slice(0, 10));
  console.log(`Local BOM system_ids (first 10):`, localIds.slice(0, 10));

  // Check for matches
  const matches = localIds.filter(id => shopifySkus.includes(id));
  console.log(`Matching SKUs: ${matches.length}/${localIds.length}`);

  if (matches.length === 0 && localIds.length > 0) {
    console.warn('NO MATCHES! Your Shopify product SKUs need to match the local system_id values.');
    console.log('Example: Local system_id "210000000948" should match a Shopify variant SKU "210000000948"');
  }

  return { shopifySkus: shopifySkus.slice(0, 20), localIds: localIds.slice(0, 20), matches };
};

/**
 * Debug: Show all loaded Shopify products
 * Call from browser console: window.debugShopifyProducts()
 */
window.debugShopifyProducts = function() {
  const products = getAllProducts();
  console.log('=== SHOPIFY PRODUCTS ===');
  console.log(`Total products: ${products.length}`);

  products.slice(0, 10).forEach(p => {
    const variants = p.variants.edges.map(v => ({
      sku: v.node.sku,
      price: v.node.price.amount,
      title: v.node.title
    }));
    console.log(`${p.title}:`, variants);
  });

  return products;
};

// --- Initialization Status ---
let initPromise = null;
let initError = null;

/**
 * Initialize Shopify service (call once on app load)
 * Safe to call multiple times - will only fetch once
 */
export async function initializeShopify() {
  if (initPromise) {
    return initPromise;
  }

  if (!SHOPIFY_CONFIG.enabled) {
    console.log('Shopify integration is disabled');
    return { success: false, reason: 'disabled' };
  }

  initPromise = (async () => {
    try {
      await loadShopifyProducts();
      return { success: true, productCount: productCache.length };
    } catch (error) {
      initError = error;
      console.error('Failed to initialize Shopify:', error);
      return { success: false, error: error.message };
    }
  })();

  return initPromise;
}

/**
 * Get initialization status
 */
export function getInitStatus() {
  if (!initPromise) return { status: 'not_started' };
  if (initError) return { status: 'error', error: initError.message };
  if (productCache) return { status: 'loaded', productCount: productCache.length };
  return { status: 'loading' };
}
