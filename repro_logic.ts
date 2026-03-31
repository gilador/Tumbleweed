
import { getOptimalShiftDuration } from "./src/service/shiftHourHelperService";
import { calculateFeasibleIntensityRange } from "./src/service/intensityRangeHelper";

// Mocking the service functions if they are complex or importing them if possible.
// Since I cannot easily import from src in a standalone script without ts-node setup matching the project, 
// I will copy the relevant logic or try to use the existing test infrastructure.

// Let's try to create a test file in `src/repro_bug.test.ts` which will be picked up by the test runner if I run it.
// Or I can just use `ts-node` if available.

// I will copy the logic from ShiftInfoSettingsView.tsx to a standalone file for quick verification.

const calculateShiftStartingTimes = (
    startTime: string,
    endTime: string,
    shiftDuration: number
  ) => {
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    const operationDurationMinutes = endTotalMinutes - startTotalMinutes;

    if (operationDurationMinutes <= 0 || shiftDuration <= 0) {
      return [];
    }

    const shiftDurationMinutes = shiftDuration * 60;
    const shiftStartTimes: string[] = [];

    let currentStartMinutes = startTotalMinutes;

    while (currentStartMinutes < endTotalMinutes) {
      const hours = Math.floor(currentStartMinutes / 60);
      const minutes = currentStartMinutes % 60;
      const timeString = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
      shiftStartTimes.push(timeString);

      currentStartMinutes += shiftDurationMinutes;
    }

    return shiftStartTimes;
  };

// Scenario:
// Start: 08:00
// End: 18:00
// Shift Duration: 1 hour (assumed for simplicity, or calculated)

// Change End to 21:00.

const start = "08:00";
const oldEnd = "18:00";
const newEnd = "21:00";
const shiftDuration = 1; // 1 hour shifts

console.log("Old End (18:00):", calculateShiftStartingTimes(start, oldEnd, shiftDuration));
console.log("New End (21:00):", calculateShiftStartingTimes(start, newEnd, shiftDuration));
