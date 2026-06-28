import type HabitTrackerPlugin from '../main';
import type {Habit} from '../types';
import {toggleHabitDate, getStreak} from '../data/database';
import {HabitModal} from './HabitModal';
import {ReorderModal} from './ReorderModal';
import {toLocalDateString} from '../utils';

/*
 * Renders the full habit tracker UI into `container`.
 * `onAfterToggle` is called after any data mutation so the caller can re-render.
 * `isCodeBlock` switches to the embedded layout: no top header, action bar below the table.
 */
export function renderHabitTable(
	container: HTMLElement,
	plugin: HabitTrackerPlugin,
	onAfterToggle: () => void,
	isCodeBlock = false,
): void {
	if (!isCodeBlock) {
		// Sidebar view: action bar sits above the table
		renderActionBar(container.createDiv({cls: 'habit-tracker-header'}), plugin, onAfterToggle);
	}

	// Generate the rolling date window
	const dates = generateDates(plugin);

	// Scrollable table wrapper
	const wrapper = container.createDiv({cls: 'habit-tracker-table-wrapper'});
	const table = wrapper.createEl('table', {cls: 'habit-tracker-table'});

	// Table header row
	const thead = table.createEl('thead');
	const headerRow = thead.createEl('tr');
	headerRow.createEl('th', {text: '', cls: 'habit-tracker-name-col'});
	for (const date of dates) {
		const th = headerRow.createEl('th', {
			text: formatDate(date, plugin),
			cls: 'habit-tracker-date-col',
		});
		if (isToday(date)) th.addClass('habit-tracker-today');
	}

	// Table body rows
	const tbody = table.createEl('tbody');
	const habits = plugin.settings.showArchived
		? plugin.data.habits
		: plugin.data.habits.filter(h => !h.archived);

	if (habits.length === 0) {
		const emptyRow = tbody.createEl('tr');
		const emptyCell = emptyRow.createEl('td', {
			text: 'No habits yet. Click + to add one.',
			cls: 'habit-tracker-empty',
		});
		emptyCell.setAttribute('colspan', String(dates.length + 1));
	} else {
		for (const habit of habits) {
			renderHabitRow(tbody, habit, dates, plugin, onAfterToggle);
		}
	}

	if (isCodeBlock) {
		// Embedded view: action bar sits below the table
		renderActionBar(container.createDiv({cls: 'habit-tracker-action-bar'}), plugin, onAfterToggle);
	}
}

function renderActionBar(
	container: HTMLElement,
	plugin: HabitTrackerPlugin,
	onAfterToggle: () => void,
): void {
	container.createEl('span', {text: 'Habit tracker', cls: 'habit-tracker-title'});
	const actions = container.createDiv({cls: 'habit-tracker-actions'});
	const reorderBtn = actions.createEl('button', {text: '⇕', cls: 'habit-tracker-reorder-btn'});
	reorderBtn.addEventListener('click', () => {
		new ReorderModal(plugin.app, plugin, onAfterToggle).open();
	});
	const addBtn = actions.createEl('button', {text: '+', cls: 'habit-tracker-add-btn'});
	addBtn.addEventListener('click', () => {
		new HabitModal(plugin.app, plugin, onAfterToggle).open();
	});
}

function renderHabitRow(
	tbody: HTMLElement,
	habit: Habit,
	dates: string[],
	plugin: HabitTrackerPlugin,
	onAfterToggle: () => void,
): void {
	const row = tbody.createEl('tr', {cls: 'habit-tracker-row'});
	const nameCell = row.createEl('td', {cls: 'habit-tracker-name'});
	const nameSpan = nameCell.createEl('span', {text: habit.name, cls: 'habit-tracker-name-text'});
	if (habit.description) nameSpan.title = habit.description;
	nameSpan.addEventListener('click', () => {
		new HabitModal(plugin.app, plugin, onAfterToggle, habit).open();
	});

	const streak = getStreak(plugin.data, habit.id);
	if (streak > 0) {
		nameCell.createEl('span', {text: String(streak), cls: 'habit-tracker-streak'});
	}

	const completedDates = plugin.data.logs[habit.id] ?? [];
	for (const date of dates) {
		const isCompleted = completedDates.includes(date);
		const cell = row.createEl('td', {
			cls: `habit-tracker-cell${isCompleted ? ' habit-tracker-cell--completed' : ''}`,
			text: isCompleted ? '✓' : '',
		});
		if (isToday(date)) cell.addClass('habit-tracker-today');
		cell.addEventListener('click', () => {
			toggleHabitDate(plugin.data, habit.id, date);
			void plugin.savePluginData();
			onAfterToggle();
		});
	}
}

// Returns an array of date strings from today back to (today - windowSize), newest first
function generateDates(plugin: HabitTrackerPlugin): string[] {
	const dates: string[] = [];
	const today = new Date();
	const windowSize = plugin.settings.dateWindowSize;
	for (let i = 0; i < windowSize; i++) {
		const date = new Date(today);
		date.setDate(today.getDate() - i);
		dates.push(toLocalDateString(date));
	}
	return dates;
}

// Formats a YYYY-MM-DD string using the dateFormat setting (e.g. "M/D" → "3/17")
function formatDate(dateStr: string, plugin: HabitTrackerPlugin): string {
	const [, month, day] = dateStr.split('-').map(Number);
	return plugin.settings.dateFormat
		.replace('M', String(month))
		.replace('D', String(day));
}

function isToday(dateStr: string): boolean {
	return dateStr === toLocalDateString(new Date());
}
