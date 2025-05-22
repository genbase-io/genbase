// lib/provider-icons.ts - Service for fetching provider icons from Terraform registry

interface ProviderInfo {
  namespace: string;
  name: string;
  logoUrl?: string;
  logoData?: string; // Base64 encoded image data
  cachedAt?: number; // Timestamp when the data was cached
}

// Cache configuration
const CACHE_KEY_PREFIX = 'tf_provider_';
const CACHE_EXPIRATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// In-memory cache for runtime performance
const memoryCache = new Map<string, ProviderInfo>();

/**
 * Gets the cache key for a provider
 */
function getCacheKey(namespace: string, name: string): string {
  return `${CACHE_KEY_PREFIX}${namespace}_${name}`;
}

/**
 * Gets provider info from cache (memory or localStorage)
 */
function getFromCache(namespace: string, name: string): ProviderInfo | null {
  const cacheKey = getCacheKey(namespace, name);
  
  // Check memory cache first (faster)
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) || null;
  }
  
  // Then check localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const info = JSON.parse(stored) as ProviderInfo;
        // Add to memory cache for faster future access
        memoryCache.set(cacheKey, info);
        return info;
      }
    } catch (error) {
      console.warn('Failed to retrieve from cache:', error);
    }
  }
  
  return null;
}

/**
 * Saves provider info to both memory and localStorage cache
 */
function saveToCache(providerInfo: ProviderInfo): void {
  const cacheKey = getCacheKey(providerInfo.namespace, providerInfo.name);
  
  // Add timestamp if not present
  if (!providerInfo.cachedAt) {
    providerInfo.cachedAt = Date.now();
  }
  
  // Save to memory cache
  memoryCache.set(cacheKey, providerInfo);
  
  // Save to localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(providerInfo));
    } catch (error) {
      console.warn('Failed to save to cache:', error);
    }
  }
}

/**
 * Checks if cached provider info is still valid
 */
function isCacheValid(providerInfo: ProviderInfo): boolean {
  if (!providerInfo.cachedAt) return false;
  
  // Check if cache has logo data and is still within expiration period
  return Boolean(
    (providerInfo.logoUrl || providerInfo.logoData) && 
    (Date.now() - providerInfo.cachedAt < CACHE_EXPIRATION)
  );
}

/**
 * Extract provider info from block type and name
 */
export function extractProviderFromBlock(block: any): ProviderInfo | null {
  // Extract from terraform block with required_providers
  if (block._metadata?.block_type === 'terraform' && block.config?.required_providers) {
    const providers = block.config.required_providers;
    
    if (typeof providers === 'object' && providers !== null) {
      for (const [_, providerConfig] of Object.entries(providers)) {
        if (typeof providerConfig === 'object' && (providerConfig as any).source) {
          const source = (providerConfig as any).source;
          const parts = source.split('/');
          if (parts.length >= 2) {
            return {
              namespace: parts[0],
              name: parts[1]
            };
          }
        }
      }
    }
  }
  
  // Extract from provider block
  if (block._metadata?.block_type === 'provider' && block.name) {
    return {
      namespace: 'hashicorp', // Default to hashicorp namespace
      name: block.name
    };
  }
  
  // Extract from resource or data block type
  if ((block._metadata?.block_type === 'resource' || block._metadata?.block_type === 'data') && block.type) {
    const providerName = block.type.split('_')[0];
    if (providerName) {
      return {
        namespace: 'hashicorp', // Default to hashicorp namespace
        name: providerName
      };
    }
  }
  
  return null;
}

/**
 * Fetch provider info from API, using cache when available
 */
export async function fetchProviderInfo(namespace: string, name: string): Promise<ProviderInfo> {
  // Check cache first
  const cachedInfo = getFromCache(namespace, name);
  
  // If we have valid cached data, return it immediately
  if (cachedInfo && isCacheValid(cachedInfo)) {
    return cachedInfo;
  }
  
  // If cache is expired or doesn't exist, fetch fresh data
  try {
    const response = await fetch(`/api/providers/${namespace}/${name}`);
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.success && result.data) {
        const data = result.data;
        const providerInfo: ProviderInfo = {
          namespace: data.namespace,
          name: data.name,
          logoUrl: data.logo_url ? 
            (data.logo_url.startsWith('http') ? data.logo_url : `https://registry.terraform.io${data.logo_url}`) 
            : undefined,
          logoData: data.logo_data || undefined,
          cachedAt: Date.now()
        };
        
        // Save to cache
        saveToCache(providerInfo);
        return providerInfo;
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch provider info for ${namespace}/${name}:`, error);
  }
  
  // If request failed but we have any cached data (even expired), use it as fallback
  if (cachedInfo) {
    return cachedInfo;
  }
  
  // No cache and request failed - return basic info
  const basicInfo: ProviderInfo = { 
    namespace, 
    name,
    cachedAt: Date.now()
  };
  
  saveToCache(basicInfo);
  return basicInfo;
}

/**
 * Get provider logo for a block
 */
export async function getProviderLogo(block: any): Promise<string | null> {
  const providerInfo = extractProviderFromBlock(block);
  
  if (!providerInfo) return null;
  
  const fullProviderInfo = await fetchProviderInfo(providerInfo.namespace, providerInfo.name);
  
  // Return logo data or URL
  return fullProviderInfo.logoData || fullProviderInfo.logoUrl || null;
}

/**
 * Extract all providers from parsed code
 */
export function extractAllProviders(parsedCode: any): ProviderInfo[] {
  const providers = new Set<string>();
  const result: ProviderInfo[] = [];
  
  // Process all blocks to find providers
  const allBlocks: any[] = [];
  
  // First check terraform blocks
  if (parsedCode.blocks?.terraform && Array.isArray(parsedCode.blocks.terraform)) {
    allBlocks.push(...parsedCode.blocks.terraform);
  }
  
  // Get all other blocks
  Object.values(parsedCode.blocks || {}).forEach(blockArray => {
    if (Array.isArray(blockArray)) {
      allBlocks.push(...blockArray);
    }
  });
  
  // Extract provider info from each block
  allBlocks.forEach(block => {
    const providerInfo = extractProviderFromBlock(block);
    if (providerInfo) {
      const key = `${providerInfo.namespace}/${providerInfo.name}`;
      if (!providers.has(key)) {
        providers.add(key);
        result.push(providerInfo);
      }
    }
  });
  
  return result;
}

/**
 * Preload provider logos for better performance
 */
export async function preloadProviderLogos(parsedCode: any): Promise<void> {
  const providers = extractAllProviders(parsedCode);
  
  // Fetch all provider info in parallel
  await Promise.allSettled(
    providers.map(provider => fetchProviderInfo(provider.namespace, provider.name))
  );
}

/**
 * Clear provider cache (for debugging/testing)
 */
export function clearProviderCache(): void {
  // Clear memory cache
  memoryCache.clear();
  
  // Clear localStorage cache
  if (typeof window !== 'undefined' && window.localStorage) {
    // Get all keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all matching keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
}