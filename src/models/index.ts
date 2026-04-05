export interface UniqueString {
  id: string;
  value: string;
}

export interface User {
  id: string;
  name: string;
}

export interface Constraint {
  postID: string;
  hourID: string;
  availability: boolean;
  assignedUser?: string;
}

export interface UserShiftData {
  user: User;
  constraints: Constraint[][];
  constraintsByRoster?: Record<string, Constraint[][]>;
  assignments?: boolean[][];
  totalAssignments: number;
}

export interface RosterState {
  id: string;
  name: string;
  posts: UniqueString[];
  hours: UniqueString[];
  assignments: (string | null)[][];
  manuallyEditedSlots: {
    [slotKey: string]: {
      originalUserId: string | null;
      currentUserId: string | null;
    };
  };
  customCellDisplayNames: { [slotKey: string]: string };
  scheduleMode: "24h" | "7d";
  startTime: string;
  endTime: string;
  startDate: string | null;
  cachedWeeklyState: {
    hours: UniqueString[];
    assignments: (string | null)[][];
    userShiftData: UserShiftData[];
    startDate: string;
  } | null;
}

export const MAX_ROSTERS = 5;

export function generateRosterId(): string {
  return `roster-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyRoster(name: string, id?: string): RosterState {
  return {
    id: id ?? generateRosterId(),
    name,
    posts: [],
    hours: [],
    assignments: [],
    manuallyEditedSlots: {},
    customCellDisplayNames: {},
    scheduleMode: "24h",
    startTime: "08:00",
    endTime: "18:00",
    startDate: null,
    cachedWeeklyState: null,
  };
}

export function getActiveRoster(rosters: RosterState[], activeRosterId: string): RosterState {
  return rosters.find((r) => r.id === activeRosterId) ?? rosters[0];
}

export type OptimizeShiftSolution = {
  result: boolean[][][];
  isOptim: boolean;
};

export class ShiftMap {
  private users: Map<string, UserShiftData> = new Map<string, UserShiftData>();

  constructor(users?: UserShiftData[]) {
    this.users = new Map<string, UserShiftData>();
    users?.forEach((user) => {
      this.addUser(user);
    });
  }

  addUser(userData: UserShiftData) {
    this.users.set(userData.user.id, userData);
  }

  getUser(userId: string): UserShiftData | undefined {
    return this.users.get(userId);
  }

  getShift(id: string): Constraint | undefined {
    for (const userData of this.users.values()) {
      for (const postConstraints of userData.constraints) {
        for (const constraint of postConstraints) {
          if (constraint.postID + constraint.hourID === id) {
            return constraint;
          }
        }
      }
    }
    return undefined;
  }

  updateUser(userData: UserShiftData) {
    this.users.set(userData.user.id, userData);
  }

  usersSize(): number {
    return this.users.size;
  }

  copy(): ShiftMap {
    const newMap = new ShiftMap();
    this.users.forEach((userData) => {
      newMap.addUser({
        ...userData,
        constraints: JSON.parse(JSON.stringify(userData.constraints)),
      });
    });
    return newMap;
  }
}
