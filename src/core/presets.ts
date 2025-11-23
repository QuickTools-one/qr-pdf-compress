import type { CompressionPreset } from '../api/types';

/**
 * Configuration for a compression preset
 */
export interface PresetConfig {
  /** Preset name */
  preset: CompressionPreset;
  /** Target DPI for image downsampling (undefined = no downsampling) */
  targetDPI?: number;
  /** JPEG quality (0-1) */
  jpegQuality?: number;
  /** Preserve metadata */
  preserveMetadata: boolean;
  /** Enable rasterization (for max preset) */
  enableRasterization: boolean;
  /** User-facing description */
  description: string;
  /** Expected compression ratio range */
  expectedSavings: string;
}

/**
 * Lossless preset configuration
 * Structural optimization only, no quality loss
 */
export const LOSSLESS_PRESET: PresetConfig = {
  preset: 'lossless',
  targetDPI: undefined, // No downsampling
  jpegQuality: undefined, // No re-encoding
  preserveMetadata: true,
  enableRasterization: false,
  description: 'Optimize structure without quality loss. Best for documents with text and vectors.',
  expectedSavings: '5-30%',
};

/**
 * Balanced preset configuration
 * Smart image compression, preserve vectors
 */
export const BALANCED_PRESET: PresetConfig = {
  preset: 'balanced',
  targetDPI: 150, // Downsample to 150 DPI
  jpegQuality: 0.65, // JPEG quality 65%
  preserveMetadata: true,
  enableRasterization: false,
  description: 'Smart compression with minimal quality impact. Recommended for most PDFs.',
  expectedSavings: '30-70%',
};

/**
 * Max preset configuration
 * Aggressive compression with optional rasterization
 */
export const MAX_PRESET: PresetConfig = {
  preset: 'max',
  targetDPI: 120, // Downsample to 120 DPI
  jpegQuality: 0.4, // JPEG quality 40%
  preserveMetadata: false,
  enableRasterization: false, // Auto-detect
  description: 'Maximum compression. May reduce image quality. Best for scanned documents.',
  expectedSavings: '60-90%',
};

/**
 * Map of all presets
 */
export const PRESETS: Record<CompressionPreset, PresetConfig> = {
  lossless: LOSSLESS_PRESET,
  balanced: BALANCED_PRESET,
  max: MAX_PRESET,
};

/**
 * Gets the configuration for a given preset
 */
export function getPresetConfig(preset: CompressionPreset): PresetConfig {
  return PRESETS[preset];
}

/**
 * Gets the preset configuration with custom overrides
 */
export function getPresetConfigWithOverrides(
  preset: CompressionPreset,
  overrides: Partial<PresetConfig> = {}
): PresetConfig {
  const baseConfig = getPresetConfig(preset);
  return {
    ...baseConfig,
    ...overrides,
  };
}

/**
 * Validates a preset name
 */
export function isValidPreset(preset: string): preset is CompressionPreset {
  return preset === 'lossless' || preset === 'balanced' || preset === 'max';
}

/**
 * Gets the fallback preset for graceful degradation
 * Returns undefined if no fallback available
 */
export function getFallbackPreset(preset: CompressionPreset): CompressionPreset | undefined {
  switch (preset) {
    case 'max':
      return 'balanced';
    case 'balanced':
      return 'lossless';
    case 'lossless':
      return undefined; // No fallback
  }
}

/**
 * Gets the ordered list of presets to try (for graceful degradation)
 */
export function getPresetFallbackChain(preset: CompressionPreset): CompressionPreset[] {
  const chain: CompressionPreset[] = [preset];
  let current = preset;

  while (true) {
    const fallback = getFallbackPreset(current);
    if (!fallback) break;
    chain.push(fallback);
    current = fallback;
  }

  return chain;
}
