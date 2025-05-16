"use client";
import { createContext, useContext, ReactNode } from 'react';

// Define possible deployment types
export type DeploymentType = 'cloud' | 'community';

// Define all possible feature flags
export interface FeatureFlags {
  userAuthentication: boolean;
  teamManagement: boolean;
  userSettings: boolean;
  billing: boolean;
}

// Context for feature flags
const FeatureFlagContext = createContext<FeatureFlags | null>(null);

// Preset configurations based on deployment type
const deploymentConfigs: Record<DeploymentType, FeatureFlags> = {
  cloud: {
    userAuthentication: true,
    teamManagement: true,
    userSettings: true,
    billing: true
  },
  community: {
    userAuthentication: false,
    teamManagement: false,
    userSettings: false,
    billing: false
  }
};

// Environment variable to determine deployment type (default to self-hosted)
// This can be set at build time
const DEPLOYMENT_TYPE = (process.env.NEXT_PUBLIC_DEPLOYMENT_TYPE || 'self-hosted') as DeploymentType;

// Provider component to wrap the application
export function FeatureFlagProvider({ 
  children,
  deploymentType = DEPLOYMENT_TYPE,
  overrides = {}
}: { 
  children: ReactNode;
  deploymentType?: DeploymentType;
  overrides?: Partial<FeatureFlags>;
}) {
  // Get base config for the deployment type and apply any overrides
  const config = {
    ...deploymentConfigs[deploymentType],
    ...overrides
  };
  
  return (
    <FeatureFlagContext.Provider value={config}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

// Hook to use feature flags in components
export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  
  return context;
}

// Helper component to conditionally render based on a feature flag
export function FeatureGate({ 
  feature, 
  children 
}: { 
  feature: keyof FeatureFlags; 
  children: ReactNode;
}) {
  const flags = useFeatureFlags();
  
  // For boolean flags, check if enabled
  if (typeof flags[feature] === 'boolean') {
    return flags[feature] ? <>{children}</> : null;
  }
  
  // For non-boolean flags, check if they have a truthy value
  return flags[feature] ? <>{children}</> : null;
}