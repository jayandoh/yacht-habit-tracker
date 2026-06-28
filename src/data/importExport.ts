import type {Habit, PluginData} from "../types";
import {toLocalDateString} from "../utils";

/*
 * Serializes plugin data to a formatted JSON string.
 */
export function exportData(data: PluginData): string {
	const habits = data.habits.map(h => {
		const out: Record<string, unknown> = {id: h.id, name: h.name, createdAt: h.createdAt};
		if (h.archived) out.archived = true; // Omit archive status for unarchived habits for a cleaner JSON file
		if (h.description) out.description = h.description; // Omit blank descriptions for a cleaner JSON file
		return out;
	});
	return JSON.stringify({habits, logs: data.logs}, null, 2);
}

/*
 * Runs validation checks on imported file.
 */
export function validateImport(rawText: string): {data: PluginData} | {error: string} {
	// Check if import is empty
	if (!rawText.trim()) {
		return {error: "Import failed: file is empty."};
	}

	// Check if import is a valid JSON
	let parsed: unknown;
	try {
		parsed = JSON.parse(rawText);
	} catch {
		return {error: "Import failed: file is not valid JSON."};
	}

	// Check if import is the correct shape
	if (
		typeof parsed !== "object" || 									// JSON must be an object
		parsed === null ||												// JSON must not be null
		!Array.isArray((parsed as Record<string, unknown>).habits) ||	// `habits` must exist and be an array
		typeof (parsed as Record<string, unknown>).logs !== "object" || // `logs` must exist be an object
		(parsed as Record<string, unknown>).logs === null				// `logs` must not be null
	) {
		return {error: "Import failed: file does not appear to be a valid habit tracker export."};
	}

	// Cast `parsed` to a specific type (appease the TS compiler)
	const raw = parsed as {habits: unknown[]; logs: Record<string, unknown>};

	// Check if import contains any habits
	if (raw.habits.length === 0) {
		return {error: "Nothing to import: file contains no habits."};
	}

	// Check required fields on each habit
	for (const h of raw.habits) {
		if (
			typeof h !== "object" ||
			h === null ||
			typeof (h as Record<string, unknown>).id !== "string" ||
			typeof (h as Record<string, unknown>).name !== "string"
		) {
			return {error: "Import failed: one or more habits have missing required fields."};
		}
	}

	// De-duplication variables and containers
	const today = toLocalDateString(new Date());
	const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

	const seenNames = new Set<string>();  // tracks habit names that have already been accepted
	const habits: Habit[] = [];			  // clean list of habits
	const droppedIds = new Set<string>(); // tracks IDs of duplicate habits that were skipped (used to drop logs)

	// De-duplicate habits by name (case-insensitive), first occurrence wins
	for (const h of raw.habits as Array<Record<string, unknown>>) {
		const key = (h.name as string).toLowerCase(); // Ignore case-sensitivity

		// If habit name has been seen, mark its ID as dropped. Otherwise, add it to set of seen names
		if (seenNames.has(key)) {
			droppedIds.add(h.id as string);
			continue;
		}
		seenNames.add(key);

		// Check if `createdAt` follows specified date pattern. If not, replace with today's date.
		const createdAt =
			typeof h.createdAt === "string" && dateRegex.test(h.createdAt) ? h.createdAt : today;
		// Read `description` defensively; non-strings and blanks are treated as absent.
		const description = typeof h.description === "string" ? h.description.trim() : "";
		// Ensure `archived` is a boolean. Default to false if non-existent.
		const archived =
			typeof h.archived === "boolean" ? h.archived : h.archived !== undefined ? !!h.archived : false;
		// Build clean `Habit` object, then push to `habits` array.
		const habit: Habit = {id: h.id as string, name: h.name as string, createdAt};
		if (description) habit.description = description;
		if (archived) habit.archived = true;
		habits.push(habit);
	}

	const validIds = new Set(habits.map(h => h.id));

	// Build cleaned logs: drop orphaned keys and invalid date strings
	const logs: Record<string, string[]> = {};
	for (const habit of habits) {
		const raw_entries = raw.logs[habit.id];
		if (Array.isArray(raw_entries)) {
			logs[habit.id] = (raw_entries as unknown[])
				.filter((d): d is string => typeof d === "string" && dateRegex.test(d));
		} else {
			logs[habit.id] = [];
		}
	}

	// Drop any log keys for habits that didn't make it through (orphaned or dropped duplicates)
	for (const key of Object.keys(raw.logs)) {
		if (!validIds.has(key)) {
			// already excluded from logs above; nothing to do
		}
	}

	return {data: {habits, logs}};
}

/*
 * Compares imported habits against existing habits by name (case-insensitive).
 */
export function detectDuplicates(
	existing: Habit[],
	imported: Habit[],
): Array<{existing: Habit; imported: Habit}> {
	const existingByName = new Map(existing.map(h => [h.name.toLowerCase(), h]));
	const duplicates: Array<{existing: Habit; imported: Habit}> = [];
	for (const imp of imported) {
		const match = existingByName.get(imp.name.toLowerCase());
		if (match) {
			duplicates.push({existing: match, imported: imp});
		}
	}
	return duplicates;
}

/*
 * Applies chosen merge strategy and returns resulting PluginData.
 */
export function mergeImport(
	current: PluginData,
	imported: PluginData,
	duplicates: Array<{existing: Habit; imported: Habit}>,
	strategy: "replace" | "mergelogs" | "ignore",
): PluginData {
	const duplicateImportedIds = new Set(duplicates.map(d => d.imported.id));

	// Start with a deep copy of current habits and logs
	const habits: Habit[] = current.habits.map(h => ({...h}));
	const logs: Record<string, string[]> = {};
	for (const h of current.habits) {
		logs[h.id] = [...(current.logs[h.id] ?? [])];
	}

	// Apply strategy to each duplicate
	for (const {existing, imported: imp} of duplicates) {
		const habitIdx = habits.findIndex(h => h.id === existing.id);
		if (habitIdx === -1) continue;

		if (strategy === "replace") {
			const current = habits[habitIdx]!;
			habits[habitIdx] = {
				id: current.id,
				name: imp.name,
				createdAt: current.createdAt,
				...(imp.archived ? {archived: true} : {}),
				...(imp.description ? {description: imp.description} : {}),
			};
			logs[existing.id] = [...(imported.logs[imp.id] ?? [])];
		} else if (strategy === "mergelogs") {
			const combined = [...(logs[existing.id] ?? []), ...(imported.logs[imp.id] ?? [])];
			const deduped = [...new Set(combined)];
			deduped.sort();
			logs[existing.id] = deduped;
		}
		// "ignore": keep existing unchanged
	}

	// Add non-duplicate imported habits (UUID remapping handled by caller/ImportModal)
	for (const imp of imported.habits) {
		if (!duplicateImportedIds.has(imp.id)) {
			habits.push({...imp});
			logs[imp.id] = [...(imported.logs[imp.id] ?? [])];
		}
	}

	return {habits, logs};
}
