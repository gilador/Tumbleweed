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
  assignments?: boolean[][];
  totalAssignments: number;
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
