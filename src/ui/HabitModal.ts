import {App, Modal, Notice, Setting} from "obsidian";
import {addHabit, updateHabit, deleteHabit} from "../data/database";
import type HabitTrackerPlugin from "../main";
import type {Habit} from "../types";

export class HabitModal extends Modal {
	private readonly plugin: HabitTrackerPlugin;
	private readonly habit?: Habit;
	private readonly onSave?: () => void;

	constructor(app: App, plugin: HabitTrackerPlugin, onSave?: () => void, habit?: Habit) {
		super(app);
		this.plugin = plugin;
		this.habit = habit;
		this.onSave = onSave;
	}

	onOpen(): void {
		const {contentEl} = this;
		const isEditing = !!this.habit;
		contentEl.empty();
		contentEl.createEl("h2", {text: isEditing ? "Edit habit" : "Add habit"});

		let name = this.habit?.name ?? "";
		let description = this.habit?.description ?? "";
		let archived = this.habit?.archived ?? false;

		new Setting(contentEl)
			.setName("Habit name")
			.addText((text) => {
				text.setPlaceholder("Read");
				text.setValue(name);
				text.onChange((value) => {
					name = value.trim();
				});
			});

		new Setting(contentEl)
			.setName("Description")
			.setDesc("(Optional) Shown when you hover the habit name.")
			.addTextArea((text) => {
				text.setPlaceholder("Read for 30min before bed");
				text.setValue(description);
				text.onChange((value) => {
					description = value.trim();
				});
			});

		if (isEditing) {
			new Setting(contentEl)
				.setName("Archived")
				.setDesc("Archived habits are hidden from the tracker by default.")
				.addToggle((toggle) => {
					toggle.setValue(archived);
					toggle.onChange((value) => {
						archived = value;
					});
				});
		}

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText(isEditing ? "Save" : "Add").setCta().onClick(async () => {
					if (!name) {
						new Notice("Habit name is required.");
						return;
					}

					if (isEditing && this.habit) {
						updateHabit(this.plugin.data, this.habit.id, {
							name,
							description,
							archived,
						});
					} else {
						addHabit(this.plugin.data, name, description);
					}

					await this.plugin.savePluginData();
					this.onSave?.();
					this.close();
				});
			})
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => this.close());
			});

		if (isEditing && this.habit) {
			const habit = this.habit;
			new Setting(contentEl)
				.addButton((button) => {
					button.setButtonText("Delete habit").setWarning().onClick(() => {
						new ConfirmModal(
							this.app,
							`Delete "${habit.name}"? This will permanently remove the habit and all its logs.`,
							async () => {
								deleteHabit(this.plugin.data, habit.id);
								await this.plugin.savePluginData();
								this.onSave?.();
								this.close();
							},
						).open();
					});
				});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class ConfirmModal extends Modal {
	private readonly message: string;
	private readonly onConfirm: () => void | Promise<void>;

	constructor(app: App, message: string, onConfirm: () => void | Promise<void>) {
		super(app);
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl("p", {text: this.message});

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Delete").setWarning().onClick(() => {
					void Promise.resolve(this.onConfirm());
					this.close();
				});
			})
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => this.close());
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
