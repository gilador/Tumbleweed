import { calculateMinimumShifts } from "./shiftHourHelperService";
import { Constraint, ShiftMap, UserShiftData } from "../models";
import { UniqueString } from "../models/index";
import { defaultHours } from "../constants/shiftManagerConstants";

// Generate dynamic hours based on shift calculation
export function generateDynamicHours(
  startTime: string,
  endTime: string,
  postCount: number,
  staffCount: number,
  minimumRestTime: number = 0
): UniqueString[] {
  const result = calculateMinimumShifts({
    startTime,
    endTime,
    postCount,
    staffCount,
    minimumTotalRestTime: minimumRestTime,
  });

  if (!result.isFeasible || result.shiftStartTimes.length === 0) {
    // Fallback to hardcoded hours if calculation fails
    console.warn(
      "generateDynamicHours: Shift calculation failed, using fallback hours"
    );
    console.warn("generateDynamicHours: Fallback hours:", defaultHours);
    return defaultHours;
  }
  console.log(
    "generateDynamicHours: Shift calculation success. result:",
    result
  );

  // Convert calculated shift times to UniqueString format
  const dynamicHours = result.shiftStartTimes.map((time, index) => ({
    id: `hour-${index + 1}`,
    value: time,
  }));

  console.log("generateDynamicHours: Generated dynamic hours:", dynamicHours);
  return dynamicHours;
}

export function getDefaultConstraints(
  posts: UniqueString[],
  hours: UniqueString[]
): Constraint[][] {
  // First level represents posts (changed from hours-first to posts-first)
  return posts.map((post) => {
    // For each post, create constraints for all hours
    return hours.map((hour) => ({
      postID: post.id,
      hourID: hour.id,
      availability: true,
    }));
  });
}

export function deriveUserDataMap(
  users: UserShiftData[] | undefined,
  defaultConstraints: Constraint[][],
  oldMap: ShiftMap
): ShiftMap {
  const newMap = new ShiftMap();
  users?.forEach((userShiftData) => {
    const existingShiftData = oldMap.getUser(userShiftData.user.id);
    let newUserConstraints = JSON.parse(JSON.stringify(defaultConstraints));

    newUserConstraints.forEach((postConstraints: Constraint[]) => {
      postConstraints.forEach((hourConstraint) => {
        const id =
          userShiftData.user.id + hourConstraint.postID + hourConstraint.hourID;
        const oldShift = oldMap.getShift(id);
        hourConstraint.availability =
          (oldShift && oldShift.availability) ?? hourConstraint.availability;
      });
    });

    const totalAssignments = existingShiftData
      ? existingShiftData.totalAssignments
      : 0;

    const updatedUserData = {
      user: userShiftData.user,
      constraints: newUserConstraints,
      totalAssignments,
    };

    newMap.addUser(updatedUserData);
  });

  return newMap;
}
