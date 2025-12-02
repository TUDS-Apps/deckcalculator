// shopifyConfig.js - Shopify Storefront API Configuration
// This file contains the configuration for connecting to your Shopify store

export const SHOPIFY_CONFIG = {
  // Store domain (without https://)
  storeDomain: 'feee6d.myshopify.com',

  // Storefront API Access Token
  // This token is safe for client-side use (read-only access to public data)
  storefrontAccessToken: 'c96a3b0e83ac7817f5962287d67fa306',

  // API Version (use latest stable version)
  apiVersion: '2024-01',

  // Enable/disable Shopify integration
  enabled: true,

  // Cache duration for product data (in milliseconds)
  cacheDuration: 5 * 60 * 1000, // 5 minutes

  // Whether to fall back to local prices if Shopify fetch fails
  fallbackToLocalPrices: true
};

// GraphQL endpoint
export const SHOPIFY_GRAPHQL_URL = `https://${SHOPIFY_CONFIG.storeDomain}/api/${SHOPIFY_CONFIG.apiVersion}/graphql.json`;
