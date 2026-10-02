import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import {exportData, validateImport} from "../data/importExport";
import {ImportModal} from "./ImportModal";
import HabitTrackerPlugin from "../main";

const FIVE_MEGABYTES = 5242880;

export interface HabitTrackerPluginSettings {
	dateWindowSize: number;   // Number of days to show as columns
	dateFormat: string;       // Format for column headers (e.g. M/D)
	showArchived: boolean;    // Whether to show archived habits
	title: string;            // Text shown in the tracker header
}

export const DEFAULT_SETTINGS: HabitTrackerPluginSettings = {
	title: 'Habit tracker',
	dateWindowSize: 30,
	dateFormat: 'M/D',
	showArchived: false,
}

export class HabitTrackerSettingTab extends PluginSettingTab {
	plugin: HabitTrackerPlugin;

	constructor(app: App, plugin: HabitTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Title')
			.setDesc('Text shown in the tracker header, such as a motivational phrase.')
			.addText(text => {
				// Fall back to the default when the field is left empty
				text.inputEl.addEventListener('blur', () => {
					if (text.getValue().trim() === '') {
						text.setValue(DEFAULT_SETTINGS.title);
						this.plugin.settings.title = DEFAULT_SETTINGS.title;
						void this.plugin.saveSettings();
					}
				});
				text.inputEl.addClass("placeholder-text");
				text
					.setPlaceholder(DEFAULT_SETTINGS.title)
					.setValue(this.plugin.settings.title)
					.onChange(async (value) => {
						this.plugin.settings.title = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Date window size')
			.setDesc('Number of days to display as columns in the tracker.')
			.addText(text => {
				// Fall back to the default when the field is left empty
				text.inputEl.addEventListener('blur', () => {
					if (text.getValue().trim() === '') {
						text.setValue(String(DEFAULT_SETTINGS.dateWindowSize));
						this.plugin.settings.dateWindowSize = DEFAULT_SETTINGS.dateWindowSize;
						void this.plugin.saveSettings();
					}
				});
				text.inputEl.addClass("placeholder-text");
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.dateWindowSize))
					.setValue(String(this.plugin.settings.dateWindowSize))
					.onChange(async (value) => {
						const parsed = parseInt(value);
						if (!isNaN(parsed) && parsed > 0) {
							this.plugin.settings.dateWindowSize = parsed;
							await this.plugin.saveSettings();
						}
					});
			});

		new Setting(containerEl)
			.setName('Date format')
			.setDesc('Format for date column headers (e.g. M/D).')
			.addText(text => {
				// Fall back to the default when the field is left empty
				text.inputEl.addEventListener('blur', () => {
					if (text.getValue().trim() === '') {
						text.setValue(String(DEFAULT_SETTINGS.dateFormat));
						this.plugin.settings.dateFormat = DEFAULT_SETTINGS.dateFormat;
						void this.plugin.saveSettings();
					}
				});
				text.inputEl.addClass("placeholder-text");
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.dateFormat))
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (value) => {
						this.plugin.settings.dateFormat = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Show archived habits')
			.setDesc('Include archived habits in the tracker view.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showArchived)
				.onChange(async (value) => {
					this.plugin.settings.showArchived = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Export data')
			.setDesc('Download all habits and logs as a JSON file.')
			.addButton(btn =>
				btn.setButtonText('Export data').onClick(() => {
					try {
						const json = exportData(this.plugin.data);
						const date = new Date().toISOString().slice(0, 10);
						const blob = new Blob([json], {type: 'application/json'});
						const url = URL.createObjectURL(blob);
						const a = document.createElement('a');
						a.href = url;
						a.download = `habit-tracker-${date}.json`;
						a.click();
						URL.revokeObjectURL(url);
					} catch {
						new Notice('Export failed.');
					}
				}),
			);

		new Setting(containerEl)
			.setName('Import data')
			.setDesc('Import habits and logs from a previously exported JSON file.')
			.addButton(btn =>
				btn.setButtonText('Import data').onClick(() => {
					const input = document.createElement('input');
					input.type = 'file';
					input.accept = '.json';
					input.onchange = () => {
						const file = input.files?.[0];
						if (!file) return;

						if (file.size > FIVE_MEGABYTES) {
							new Notice('Import failed: file is too large.');
							return;
						}

						const reader = new FileReader();
						reader.onerror = () => new Notice('Import failed: could not read file.');
						reader.onload = () => {
							const text = reader.result as string;
							const result = validateImport(text);
							if ('error' in result) {
								new Notice(result.error);
								return;
							}
							new ImportModal(this.plugin, result.data).open();
						};
						reader.readAsText(file);
					};
					input.click();
				}),
			);
	}
}
