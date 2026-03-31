import { UniqueString } from "../models/index";

// Operation time configuration
export const OPERATION_START_TIME = "08:00";
export const OPERATION_END_TIME = "18:00";
export const MINIMUM_REST_TIME = 4; // hours - minimum rest between shifts

export const defaultPosts: UniqueString[] = [
  { id: "post-1", value: "עמדה 1" },
  { id: "post-2", value: "עמדה 2" },
];

// Fallback hours for when dynamic calculation is not available
export const defaultHours: UniqueString[] = [
  { id: "hour-1", value: "08:00" },
  { id: "hour-2", value: "09:00" },
  { id: "hour-3", value: "10:00" },
  { id: "hour-4", value: "11:00" },
  { id: "hour-5", value: "12:00" },
];

// Default worker count for calculations
export const DEFAULT_STAFF_COUNT = 10;
