import {App, Modal, Setting} from 'obsidian';

export class CreateDailyNoteModal extends Modal {
	private readonly filename: string;
	private readonly onConfirm: () => void | Promise<void>;

	constructor(app: App, filename: string, onConfirm: () => void | Promise<void>) {
		super(app);
		this.filename = filename;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const {contentEl} = this;
		contentEl.empty();
		// Title casing is specified in the issue request
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		this.setTitle('New Daily Note');
		contentEl.createEl('p', {text: `File ${this.filename} does not exist. Would you like to create it?`});

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText('Never mind').onClick(() => this.close());
			})
			.addButton((button) => {
				button.setButtonText('Create').setCta().onClick(() => {
					void Promise.resolve(this.onConfirm());
					this.close();
				});
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
