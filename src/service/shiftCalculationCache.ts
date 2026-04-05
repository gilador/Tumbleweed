import { getOptimalShiftDuration } from "./shiftHourHelperService";

export interface ShiftCalculationKey {
  startTime: string;
  endTime: string;
  postCount: number;
  staffCount: number;
}

export interface IntensityDurationMap {
  [intensity: number]: number; // intensity -> duration
}

export interface DistinguishedIntensityResult {
  distinguishedIntensities: number[];
  intensityDurationMap: IntensityDurationMap;
  durationGroups: { [duration: string]: number[] }; // duration -> intensities that yield this duration
}

// Global cache for memoization
const calculationCache = new Map<string, DistinguishedIntensityResult>();

/**
 * Creates a cache key for memoization
 */
function createCacheKey(params: ShiftCalculationKey): string {
  return `${params.startTime}-${params.endTime}-${params.postCount}-${params.staffCount}`;
}

/**
 * Computes distinguished intensity values with memoization
 * Only returns intensity steps that yield different duration results
 */
export function getDistinguishedIntensities(
  params: ShiftCalculationKey
): DistinguishedIntensityResult {
  const cacheKey = createCacheKey(params);

  // Check cache first
  const cached = calculationCache.get(cacheKey);
  if (cached) {
    console.log("🚀 [shiftCalculationCache] Cache hit for:", cacheKey);
    return cached;
  }

  console.log(
    "🔄 [shiftCalculationCache] Computing distinguished intensities for:",
    params
  );

  // If no posts or staff, return minimal result
  if (params.postCount === 0 || params.staffCount === 0) {
    const result: DistinguishedIntensityResult = {
      distinguishedIntensities: [1],
      intensityDurationMap: { 1: 0 },
      durationGroups: { "0": [1] },
    };
    calculationCache.set(cacheKey, result);
    return result;
  }

  // Calculate operation time to determine reasonable max intensity
  const operationTimeHours = calculateOperationTime(
    params.startTime,
    params.endTime
  );
  if (operationTimeHours <= 0) {
    const result: DistinguishedIntensityResult = {
      distinguishedIntensities: [1],
      intensityDurationMap: { 1: 0 },
      durationGroups: { "0": [1] },
    };
    calculationCache.set(cacheKey, result);
    return result;
  }

  // Test all possible intensity values
  const candidateIntensities = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const intensityDurationMap: IntensityDurationMap = {};
  const durationGroups: { [duration: string]: number[] } = {};

  for (const intensity of candidateIntensities) {
    // Skip intensities that are >= operation time
    if (intensity >= operationTimeHours) {
      continue;
    }

    try {
      const duration = getOptimalShiftDuration(
        params.startTime,
        params.endTime,
        params.postCount,
        params.staffCount,
        intensity
      );

      if (duration > 0) {
        intensityDurationMap[intensity] = duration;
        const durationKey = duration.toFixed(2); // Use 2 decimal precision for grouping

        if (!durationGroups[durationKey]) {
          durationGroups[durationKey] = [];
        }
        durationGroups[durationKey].push(intensity);

        console.log(
          `📊 [shiftCalculationCache] Intensity ${intensity}h → ${duration}h duration`
        );
      }
    } catch (error) {
      console.log(
        `❌ [shiftCalculationCache] Intensity ${intensity}h failed: ${error}`
      );
    }
  }

  // Create distinguished intensities: keep one representative per duration group.
  // If all intensities produce the same duration, show min, mid, and max
  // so the user can still control rest time even when it doesn't change shifts.
  const distinguishedIntensities: number[] = [];

  const allGroups = Object.entries(durationGroups)
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b));

  if (allGroups.length === 1 && allGroups[0][1].length > 1) {
    // All intensities produce the same duration — show a spread
    const all = allGroups[0][1].sort((a, b) => a - b);
    const min = all[0];
    const max = all[all.length - 1];
    const mid = all[Math.floor(all.length / 2)];
    const spread = new Set([min, mid, max]);
    spread.forEach((v) => distinguishedIntensities.push(v));
    distinguishedIntensities.sort((a, b) => a - b);
  } else {
    allGroups.forEach(([, intensitiesForDuration]) => {
      const maxIntensity = Math.max(...intensitiesForDuration);
      distinguishedIntensities.push(maxIntensity);
    });
  }

  allGroups.forEach(([durationKey, intensitiesForDuration]) => {
      console.log(
        `🎯 [shiftCalculationCache] Duration ${durationKey}h: intensities [${intensitiesForDuration.join(", ")}]`
      );
    });

  // Ensure we have at least one feasible option
  if (distinguishedIntensities.length === 0) {
    console.warn(
      "⚠️ [shiftCalculationCache] No distinguished intensities found, defaulting to [1]"
    );
    const result: DistinguishedIntensityResult = {
      distinguishedIntensities: [1],
      intensityDurationMap: { 1: 0 },
      durationGroups: { "0": [1] },
    };
    calculationCache.set(cacheKey, result);
    return result;
  }

  const result: DistinguishedIntensityResult = {
    distinguishedIntensities,
    intensityDurationMap,
    durationGroups,
  };

  console.log("📋 [shiftCalculationCache] Final distinguished intensities:", {
    distinguishedIntensities,
    totalCalculated: Object.keys(intensityDurationMap).length,
    durationGroups: Object.keys(durationGroups).length,
  });

  // Cache the result
  calculationCache.set(cacheKey, result);
  return result;
}

/**
 * Clear cache (useful for testing or when parameters change significantly)
 */
export function clearCalculationCache(): void {
  console.log("🗑️ [shiftCalculationCache] Clearing cache");
  calculationCache.clear();
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: calculationCache.size,
    keys: Array.from(calculationCache.keys()),
  };
}

/**
 * Simple operation time calculator (copied from intensityRangeHelper)
 */
function calculateOperationTime(startTime: string, endTime: string): number {
  try {
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);

    const startTotalHours = startHours + startMinutes / 60;
    const endTotalHours = endHours + endMinutes / 60;

    // Handle overnight shifts (not supported, return 0)
    if (endTotalHours <= startTotalHours) {
      return 0;
    }

    return endTotalHours - startTotalHours;
  } catch (error) {
    console.error("Error calculating operation time:", error);
    return 0;
  }
}
