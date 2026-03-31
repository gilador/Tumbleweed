export const LOCAL_STORAGE_KEY = "pakal-shmira-shiftState";

export async function loadStateFromLocalStorage<T>(
  key: string
): Promise<T | null> {
  try {
    const serializedState = localStorage.getItem(key);
    if (serializedState === null) {
      return null;
    }
    return JSON.parse(serializedState) as T;
  } catch (error) {
    console.error("Could not load state from localStorage:", error);
    throw error; // Re-throw to be caught by the caller
  }
}

export async function saveStateToLocalStorage<T>(
  key: string,
  state: T
): Promise<void> {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem(key, serializedState);
  } catch (error) {
    console.error("Could not save state to localStorage:", error);
    throw error; // Re-throw to be caught by the caller
  }
}
