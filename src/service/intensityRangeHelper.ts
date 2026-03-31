import {
  getDistinguishedIntensities,
  ShiftCalculationKey,
} from "./shiftCalculationCache";

export interface IntensityRangeResult {
  feasibleIntensities: number[];
  recommendedIntensity: number;
  maxFeasibleIntensity: number;
  minFeasibleIntensity: number;
  intensityDurationMap: { [intensity: number]: number };
}

/**
 * Calculates distinguished intensity range with memoization for performance
 * Only returns intensity steps that yield different duration results
 */
export function calculateFeasibleIntensityRange(
  startTime: string,
  endTime: string,
  postCount: number,
  staffCount: number
): IntensityRangeResult {
  console.log(
    "🔍 [intensityRangeHelper] Calculating distinguished intensity range:",
    {
      startTime,
      endTime,
      postCount,
      staffCount,
    }
  );

  const params: ShiftCalculationKey = {
    startTime,
    endTime,
    postCount,
    staffCount,
  };

  // Use the optimized distinguished intensities calculation
  const result = getDistinguishedIntensities(params);

  const { distinguishedIntensities, intensityDurationMap } = result;

  // If no distinguished intensities, return minimal range
  if (distinguishedIntensities.length === 0) {
    return {
      feasibleIntensities: [1],
      recommendedIntensity: 1,
      maxFeasibleIntensity: 1,
      minFeasibleIntensity: 1,
      intensityDurationMap: { 1: 0 },
    };
  }

  const minFeasible = Math.min(...distinguishedIntensities);
  const maxFeasible = Math.max(...distinguishedIntensities);

  // Recommend middle value or a reasonable default
  const recommendedIntensity =
    distinguishedIntensities.length > 2
      ? distinguishedIntensities[
          Math.floor(distinguishedIntensities.length / 2)
        ]
      : distinguishedIntensities[0];

  console.log("🎯 [intensityRangeHelper] Distinguished intensity result:", {
    feasibleIntensities: distinguishedIntensities,
    recommendedIntensity,
    maxFeasibleIntensity: maxFeasible,
    minFeasibleIntensity: minFeasible,
    totalCalculated: Object.keys(intensityDurationMap).length,
    finalCount: distinguishedIntensities.length,
  });

  return {
    feasibleIntensities: distinguishedIntensities,
    recommendedIntensity,
    maxFeasibleIntensity: maxFeasible,
    minFeasibleIntensity: minFeasible,
    intensityDurationMap,
  };
}
