import { Constraint } from "../models";
import { UniqueString } from "../models/index";
import { defaultHours } from "../constants/shiftManagerConstants";
import { computeLevels } from "./shiftLevels";
import { encodeFlatHour } from "./weeklyScheduleUtils";

/**
 * Generate dynamic hours based on a selected shift level.
 * Uses computeLevels to find the level, then generates evenly-spaced time slots.
 */
export function generateDynamicHours(
  startTime: string,
  endTime: string,
  postCount: number,
  staffCount: number,
  selectedShiftCount: number | null
): UniqueString[] {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let opMinutes = (eh * 60 + em) - (sh * 60 + sm);
  if (opMinutes <= 0) opMinutes += 24 * 60;
  const opHours = opMinutes / 60;

  const levels = computeLevels(opHours, postCount, staffCount);

  // Find the selected level, or pick the middle feasible one
  let level = selectedShiftCount !== null
    ? levels.find((l) => l.shifts === selectedShiftCount)
    : null;

  if (!level) {
    const feasible = levels.filter((l) => l.feasible);
    level = feasible.length > 0
      ? feasible[Math.floor(feasible.length / 2)]
      : levels[0];
  }

  if (!level || level.shifts === 0) {
    console.warn("generateDynamicHours: No valid level, using fallback hours");
    return defaultHours;
  }

  // Generate evenly-spaced shift start times
  const durationMinutes = Math.round(level.duration * 60);
  const dynamicHours: UniqueString[] = [];

  for (let i = 0; i < level.shifts; i++) {
    const totalMinutes = sh * 60 + sm + i * durationMinutes;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    dynamicHours.push({
      id: `hour-${i + 1}`,
      value: time,
    });
  }

  console.log("generateDynamicHours: Generated", dynamicHours.length, "hours for", level.shifts, "shifts of", level.duration, "h");
  return dynamicHours;
}

/**
 * Generate weekly hours (7 days × single-day hours) from single-day parameters.
 * Each hour value uses the "dayIndex·HH:MM" encoding for weekly mode.
 */
export function generateWeeklyDynamicHours(
  startTime: string,
  endTime: string,
  postCount: number,
  staffCount: number,
  selectedShiftCount: number | null
): UniqueString[] {
  const singleDayHours = generateDynamicHours(startTime, endTime, postCount, staffCount, selectedShiftCount);
  const weeklyHours: UniqueString[] = [];
  for (let day = 0; day < 7; day++) {
    for (let i = 0; i < singleDayHours.length; i++) {
      weeklyHours.push({
        id: `d${day}-h${i}`,
        value: encodeFlatHour(day, singleDayHours[i].value),
      });
    }
  }
  return weeklyHours;
}

export function getDefaultConstraints(
  posts: UniqueString[],
  hours: UniqueString[]
): Constraint[][] {
  return posts.map((post) => {
    return hours.map((hour) => ({
      postID: post.id,
      hourID: hour.id,
      availability: true,
    }));
  });
}
