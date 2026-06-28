import {Habit, PluginData} from "../types"
import {toLocalDateString} from "../utils"

export function addHabit(data: PluginData, name: string, description?: string): Habit {
	const habit: Habit = {
		id: crypto.randomUUID(),
		name,
		createdAt: toLocalDateString(new Date()),
	};
	if (description) habit.description = description;
	data.habits.push(habit)
	data.logs[habit.id] = [];
	return habit;
}

export function updateHabit(
    data: PluginData,
    id: string,
    updates: Partial<Pick<Habit, 'name' | 'description' | 'archived'>>,
): void {
    const habit = data.habits.find(h => h.id === id);
    if (!habit) return;
    Object.assign(habit, updates);
    if (!habit.description) delete habit.description;
}

export function deleteHabit(data: PluginData, id: string): void {
    // Replace Habits array with a new array without the deleted habit
	data.habits = data.habits.filter(h => h.id !== id);
    // Don't forget to remove its logs too
	delete data.logs[id];
}

export function toggleHabitDate(data: PluginData, id: string, date: string): void {
    // Catch if there's a missing log entry (initialize empty array if missing)
	if (!data.logs[id]) {
		data.logs[id] = [];
	}

    // Add or remove (toggle) date from log
	const index = data.logs[id].indexOf(date);
	if (index === -1) {
		data.logs[id].push(date);
	} else {
		data.logs[id].splice(index, 1);
	}
}

export function getCompletedDates(data: PluginData, id: string): string[] {
    // Catch if a log entry doesn't exist
    if (!data.logs[id]) {
		return [];
	}
    return data.logs[id];
}

export function getStreak(data: PluginData, id: string): number {
	const completed = new Set(data.logs[id] ?? []);
	const today = new Date();
	const toDateString = (d: Date) => toLocalDateString(d);

	// If today is not completed, start counting from yesterday so the
	// streak remains active until the end of the day
	const todayStr = toDateString(today);
	const startOffset = completed.has(todayStr) ? 0 : 1;

	let streak = 0;
	for (let i = startOffset; i < 365; i++) {
		const date = new Date(today);
		date.setDate(today.getDate() - i);
		if (completed.has(toDateString(date))) {
			streak++;
		} else {
			break;
		}
	}
	return streak;
}
