import { UserShiftData } from "@/models";
import { trackEvent } from "@/lib/analytics";

export interface OptimizedShiftResult {
  result: boolean[][][];
  isOptim: boolean;
  infeasiblePositions?: Array<{
    shift: number;
    time_slot: number;
    postID: string;
    hourID: string;
    description: string;
  }>;
  error?: string;
}

// Load HiGHS once
let highsPromise: Promise<any> | null = null;

async function getHighs() {
  if (!highsPromise) {
    highsPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      // Use the more reliable highs-js version
      script.src = "https://lovasoa.github.io/highs-js/highs.js";
      script.async = true;
      script.onload = () => {
        // @ts-ignore - HiGHS is loaded globally
        const highs = window.Module();
        console.log("HiGHS library loaded:", {
          available: !!highs,
          version: highs?.version || "unknown",
        });
        resolve(highs);
      };
      document.body.appendChild(script);
    });
  }
  return highsPromise;
}

// Convert our problem to LP format
function convertToLPFormat(availabilityMatrix: boolean[][][]): string {
  const num_users = availabilityMatrix.length;
  const num_shifts = availabilityMatrix[0].length;
  const num_time_slots = availabilityMatrix[0][0].length;

  let lp = "Minimize\n obj: ";

  // Create variables to track assignments per user
  // In standard LP format, we can approximate minimizing standard deviation by:
  // 1. Introducing "above_avg" and "below_avg" variables for each user
  // 2. Constraining these to capture the absolute deviation from the mean
  // 3. Minimizing the sum of these deviations

  // First, calculate the expected average assignments per user
  const total_slots = num_shifts * num_time_slots;
  const expected_avg = total_slots / num_users;

  console.log(
    `Optimization goal: Even distribution around ${expected_avg.toFixed(
      2
    )} assignments per worker`
  );

  // For each user, create deviation variables
  for (let user = 0; user < num_users; user++) {
    // Add positive deviation variables to objective (minimize them)
    lp += `1 above_avg_${user} + 1 below_avg_${user} + `;
  }

  // Remove the trailing " + "
  lp = lp.slice(0, -3);

  lp += "\nSubject To\n";

  // Constraint: define the deviation variables in terms of assignment variables
  let constraintId = 1;
  for (let user = 0; user < num_users; user++) {
    lp += ` c${constraintId++}: `;

    // Sum all assignments for this user
    for (let shift = 0; shift < num_shifts; shift++) {
      for (let time_slot = 0; time_slot < num_time_slots; time_slot++) {
        if (availabilityMatrix[user][shift][time_slot]) {
          lp += `1 x_${user}_${shift}_${time_slot} + `;
        }
      }
    }

    // If user has any availability
    if (lp.endsWith(" + ")) {
      // Remove trailing " + "
      lp = lp.slice(0, -3);

      // Define relationship between assignments and deviation variables
      lp += ` - 1 above_avg_${user} + 1 below_avg_${user} = ${expected_avg}\n`;
    } else {
      // If user has no availability for any shift/time slot
      lp += ` - 1 above_avg_${user} + 1 below_avg_${user} = 0\n`;
    }
  }

  // 1. Each shift-time_slot must have exactly one user
  for (let shift = 0; shift < num_shifts; shift++) {
    for (let time_slot = 0; time_slot < num_time_slots; time_slot++) {
      lp += ` c${constraintId++}: `;

      // Add coefficients for available users
      let anyAvailable = false;
      for (let user = 0; user < num_users; user++) {
        if (availabilityMatrix[user][shift][time_slot]) {
          lp += `1 x_${user}_${shift}_${time_slot} + `;
          anyAvailable = true;
        }
      }

      if (anyAvailable) {
        // Remove the trailing " + "
        lp = lp.slice(0, -3);
        lp += " = 1\n";
      } else {
        // If no user is available, skip this constraint
        lp = lp.slice(0, -3);
        console.warn(
          `No users available for shift ${shift}, time slot ${time_slot}`
        );
      }
    }
  }

  // 2. One user can only be assigned to ONE post per time slot
  for (let user = 0; user < num_users; user++) {
    for (let time_slot = 0; time_slot < num_time_slots; time_slot++) {
      let constraintParts: string[] = [];
      
      for (let shift = 0; shift < num_shifts; shift++) {
        if (availabilityMatrix[user][shift][time_slot]) {
          constraintParts.push(`x_${user}_${shift}_${time_slot}`);
        }
      }

      // Only add constraint if user is available for at least 2 posts in this time slot
      if (constraintParts.length > 1) {
        lp += ` c${constraintId++}: ${constraintParts.join(" + ")} <= 1\n`;
      }
    }
  }

  // 3. No consecutive time slots for same user
  for (let user = 0; user < num_users; user++) {
    for (let time_slot = 0; time_slot < num_time_slots - 1; time_slot++) {
      let constraintParts: string[] = [];

      // Add all assignments for current time slot
      for (let shift = 0; shift < num_shifts; shift++) {
        if (availabilityMatrix[user][shift][time_slot]) {
          constraintParts.push(`x_${user}_${shift}_${time_slot}`);
        }
      }

      // Add all assignments for next time slot
      for (let shift = 0; shift < num_shifts; shift++) {
        if (availabilityMatrix[user][shift][time_slot + 1]) {
          constraintParts.push(`x_${user}_${shift}_${time_slot + 1}`);
        }
      }

      // Only add constraint if there are variables involved
      if (constraintParts.length > 0) {
        lp += ` c${constraintId++}: ${constraintParts.join(" + ")} <= 1\n`;
      }
    }
  }

  lp += "Binary\n";

  // Binary variables for assignments
  for (let user = 0; user < num_users; user++) {
    for (let shift = 0; shift < num_shifts; shift++) {
      for (let time_slot = 0; time_slot < num_time_slots; time_slot++) {
        if (availabilityMatrix[user][shift][time_slot]) {
          lp += ` x_${user}_${shift}_${time_slot}\n`;
        }
      }
    }
  }

  // Add bounds for the deviation variables
  lp += "Bounds\n";
  for (let user = 0; user < num_users; user++) {
    lp += ` 0 <= above_avg_${user}\n`;
    lp += ` 0 <= below_avg_${user}\n`;
  }

  lp += "End";

  console.log("LP problem:", lp);
  return lp;
}

// Parse the solution from HiGHS solve format to our format
function parseLPSolution(
  solution: any,
  numUsers: number,
  numPosts: number,
  numTimeSlots: number
): boolean[][][] {
  // Initialize result in the expected format [posts][timeSlots][users]
  // Use dynamic dimensions from the actual data
  const result: boolean[][][] = Array(numPosts)
    .fill(false)
    .map(() =>
      Array(numTimeSlots)
        .fill(false)
        .map(() => Array(numUsers).fill(false))
    );

  try {
    // If solution is optimal and has columns
    if (solution && solution.Status === "Optimal" && solution.Columns) {
      // Track assignments per user to verify even distribution
      const assignmentsPerUser: number[] = Array(numUsers).fill(0);
      const deviations: { above: number; below: number }[] = Array(numUsers)
        .fill(0)
        .map(() => ({ above: 0, below: 0 }));

      // First collect all assignments to understand the structure
      const assignments: { user: number; post: number; hour: number }[] = [];

      // Parse each variable
      for (const [name, details] of Object.entries(solution.Columns)) {
        const value = (details as any).Primal;

        // Process assignment variables (x_user_shift_timeSlot)
        if (name.startsWith("x_") && Math.abs(value - 1) < 1e-6) {
          // Extract indices from variable name (x_user_shift_timeSlot)
          const parts = name.split("_");
          if (parts.length === 4 && parts[0] === "x") {
            const user = parseInt(parts[1], 10);
            const shift = parseInt(parts[2], 10);
            const timeSlot = parseInt(parts[3], 10);

            // Track assignment for stats
            if (user >= 0 && user < numUsers) {
              assignmentsPerUser[user]++;
            }

            // IMPORTANT: The optimizer uses [user][shift][timeSlot] format
            // But our UI expects [post][hour][user] format
            // Here shift is actually the post, and timeSlot is the hour
            const post = shift; // shift in optimizer = post in UI
            const hour = timeSlot; // timeSlot in optimizer = hour in UI

            // Only store assignments for valid posts and hours (dynamic bounds)
            if (
              post >= 0 &&
              post < numPosts &&
              hour >= 0 &&
              hour < numTimeSlots
            ) {
              assignments.push({ user, post, hour });
            } else {
              console.warn(`Skipping invalid assignment:`, {
                user,
                post,
                hour,
              });
            }
          }
        }

        // Track deviations for analysis
        if (name.startsWith("above_avg_") && Math.abs(value) > 1e-6) {
          const user = parseInt(name.substring("above_avg_".length), 10);
          if (user >= 0 && user < numUsers) {
            deviations[user].above = value;
          }
        }

        if (name.startsWith("below_avg_") && Math.abs(value) > 1e-6) {
          const user = parseInt(name.substring("below_avg_".length), 10);
          if (user >= 0 && user < numUsers) {
            deviations[user].below = value;
          }
        }
      }

      // Fill in the result array using the collected assignments
      for (const { user, post, hour } of assignments) {
        // Double-check bounds before setting (use dynamic dimensions)
        if (
          post < 0 ||
          post >= numPosts ||
          hour < 0 ||
          hour >= numTimeSlots ||
          user < 0 ||
          user >= numUsers
        ) {
          console.warn(`Skipping out-of-bounds assignment:`, {
            post,
            hour,
            user,
            bounds: { numPosts, numTimeSlots, numUsers },
          });
          continue;
        }

        result[post][hour][user] = true;
      }

      return result;
    }
  } catch (error) {
    console.error("Error parsing LP solution:", error);
    // Return empty solution on error
    return createEmptySolution(numPosts, numTimeSlots, numUsers);
  }

  return result;
}

function createEmptySolution(
  numPosts: number,
  numTimeSlots: number,
  numUsers: number
): boolean[][][] {
  // Create a solution with dynamic dimensions
  return Array(numPosts)
    .fill(false)
    .map(() =>
      Array(numTimeSlots)
        .fill(false)
        .map(() => Array(numUsers).fill(false))
    );
}

function validateSolution(
  solution: boolean[][][],
  numPosts: number,
  numTimeSlots: number,
  numUsers: number
): boolean[][][] {
  // Ensure the solution has exactly the right structure
  if (
    !solution ||
    !Array.isArray(solution) ||
    solution.length !== numPosts ||
    !Array.isArray(solution[0]) ||
    solution[0].length !== numTimeSlots ||
    !Array.isArray(solution[0][0]) ||
    solution[0][0].length !== numUsers
  ) {
    console.error(
      `Invalid solution structure, returning empty solution with ${numTimeSlots} time slots`
    );
    return createEmptySolution(numPosts, numTimeSlots, numUsers);
  }
  return solution;
}

export async function optimizeShift(
  userData: UserShiftData[]
): Promise<OptimizedShiftResult> {
  try {
    console.log("Starting optimization with userData:", {
      numUsers: userData.length,
      sampleUser: userData[0],
    });

    console.log("optimizeShift: Detailed user data analysis:", {
      totalUsers: userData.length,
      firstUserConstraints: userData[0]?.constraints?.length || 0,
      firstUserFirstPostConstraints: userData[0]?.constraints?.[0]?.length || 0,
      sampleConstraintStructure:
        userData[0]?.constraints?.[0]?.slice(0, 3) || [],
    });

    if (!userData || userData.length === 0) {
      console.error("No user data provided");
      return {
        result: createEmptySolution(3, 5, 12), // fallback dimensions
        isOptim: false,
      };
    }

    // Convert user data to availability matrix
    const availabilityMatrix = userData.map((user) =>
      user.constraints.map((shift) => {
        // Get all time slots dynamically - no hardcoded limit
        return shift.map((slot) => slot.availability);
      })
    );

    // Extract dimensions from the actual data
    const numUsers = userData.length;
    const numPosts = userData[0]?.constraints.length || 3;
    const numTimeSlots = userData[0]?.constraints[0]?.length || 5;

    // Check if we have enough available users for each shift and time slot
    let isFeasible = true;
    let infeasiblePositions = [];

    // For each shift-time slot, check if at least one user is available
    for (let shift = 0; shift < availabilityMatrix[0].length; shift++) {
      for (
        let time_slot = 0;
        time_slot < availabilityMatrix[0][0].length;
        time_slot++
      ) {
        let anyAvailable = false;
        for (let user = 0; user < availabilityMatrix.length; user++) {
          if (availabilityMatrix[user][shift][time_slot]) {
            anyAvailable = true;
            break;
          }
        }
        if (!anyAvailable) {
          isFeasible = false;
          infeasiblePositions.push({ shift, time_slot });
        }
      }
    }

    console.log("Feasibility check:", {
      isFeasible,
      infeasiblePositions,
    });

    console.log("Created availability matrix:", {
      users: availabilityMatrix.length,
      shifts: availabilityMatrix[0].length,
      timeSlots: availabilityMatrix[0][0].length,
      sample: availabilityMatrix[0].map((s) => s.slice(0, 5)),
      totalAvailable: availabilityMatrix.reduce(
        (sum, user) =>
          sum +
          user.reduce(
            (userSum, shift) =>
              userSum + shift.filter((available) => available).length,
            0
          ),
        0
      ),
    });

    // If the problem is infeasible, return early with detailed information
    if (!isFeasible) {
      // Get post and hour information for better error messages
      const posts = userData[0]?.constraints || [];
      const hours = posts[0] || [];

      const detailedInfeasiblePositions = infeasiblePositions.map(
        ({ shift, time_slot }) => {
          const postID = posts[shift]?.[time_slot]?.postID || `post-${shift}`;
          const hourID = hours[time_slot]?.hourID || `hour-${time_slot}`;
          return {
            shift,
            time_slot,
            postID,
            hourID,
            description: `Post ${shift + 1} at time slot ${time_slot + 1}`,
          };
        }
      );

      console.error(
        "Problem is infeasible: some shifts have no available users"
      );
      console.error(
        "Infeasible positions details:",
        detailedInfeasiblePositions
      );

      return {
        result: createEmptySolution(numPosts, numTimeSlots, numUsers),
        isOptim: false,
        infeasiblePositions: detailedInfeasiblePositions,
        error:
          "Some shifts have no available users. Please check user availability for the highlighted time slots.",
      };
    }

    // Get HiGHS instance
    const highs = await getHighs();

    // Convert to LP format
    const lpProblem = convertToLPFormat(availabilityMatrix);
    console.log("LP problem formulation:", {
      problemSize: lpProblem.length,
      sample: lpProblem.substring(0, 500) + "...",
    });

    // Try using the high-level HiGHS solve API
    try {
      console.log("Calling HiGHS solver with LP format...");
      const result = highs.solve(lpProblem);

      console.log("HiGHS solve result:", {
        status: result.Status,
        objectiveValue: result.ObjectiveValue,
        isOptimal: result.Status === "Optimal",
      });

      // Parse the solution to our format
      const solution = parseLPSolution(
        result,
        availabilityMatrix.length,
        availabilityMatrix[0].length,
        availabilityMatrix[0][0].length
      );

      // Check if the solver actually found a solution
      if (result.Status !== "Optimal") {
        console.warn("Solver returned non-optimal status:", result.Status);
        return {
          result: createEmptySolution(numPosts, numTimeSlots, numUsers),
          isOptim: false,
          error: `Optimization failed: The solver could not find a valid solution (Status: ${result.Status}). This usually means there are not enough available workers to cover all shifts under the current constraints.`,
        };
      }

      // Validate and return the solution
      const validatedSolution = validateSolution(
        solution,
        numPosts,
        numTimeSlots,
        numUsers
      );

      // Check for missing assignments
      console.log("Checking for missing assignments in solution:");
      let missingAssignments = [];
      for (
        let postIndex = 0;
        postIndex < validatedSolution.length;
        postIndex++
      ) {
        for (
          let shiftIndex = 0;
          shiftIndex < validatedSolution[postIndex].length;
          shiftIndex++
        ) {
          const shiftData = validatedSolution[postIndex][shiftIndex];
          const hasAssignment = shiftData.some((value) => value === true);

          if (!hasAssignment) {
            missingAssignments.push({ post: postIndex, shift: shiftIndex });
          }
        }
      }

      if (missingAssignments.length > 0) {
        console.warn(
          `IMPORTANT: Found ${missingAssignments.length} shift-post combinations with NO assignments:`,
          missingAssignments
        );
        console.warn(
          "This might be expected if there are no available workers for these shifts"
        );
      }

      console.log("Returning validated solution:", {
        posts: validatedSolution.length,
        shifts: validatedSolution[0].length,
        users: validatedSolution[0][0].length,
        assigned: validatedSolution.reduce(
          (sum, post) =>
            sum +
            post.reduce(
              (postSum, shift) =>
                postSum + shift.filter((assigned) => assigned).length,
              0
            ),
          0
        ),
      });

      trackEvent("optimizer-run", {
        staffCount: userData.length,
        constraintCount: numPosts * numTimeSlots,
      });

      return {
        result: validatedSolution,
        isOptim: true,
      };
    } catch (solverError) {
      console.error("Error during HiGHS solver call:", solverError);
      return {
        result: createEmptySolution(3, 5, 12), // fallback dimensions
        isOptim: false,
      };
    }
  } catch (error) {
    console.error("Error in optimization:", error);
    return {
      result: createEmptySolution(3, 5, 12), // fallback dimensions
      isOptim: false,
    };
  }
}
