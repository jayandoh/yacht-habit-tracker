/*
 * Interface: Habit
 * Description: Object with key information describing a habit
 */
export interface Habit {
    id: string;         // UUID
    name: string;
    description?: string;
    createdAt: string;  // ISO date
    archived?: boolean;
}

/*
 * Interface: HabitLog
 * Description: Object that stores logs of dates a habit was completed
 */
export interface HabitLog {
    [habitId: string]: string[]; // array of "YYYY-MM-DD" date strings
}

/* 
 * Interface: PluginData
 * Description: Persistent object that holds all of the plugin's data
 */
export interface PluginData {
    habits: Habit[];
    logs: HabitLog;
}
