import {App, Notice, TFile, moment, normalizePath} from 'obsidian';

interface DailyNoteOptions {
	folder?: string;
	format?: string;
	template?: string;
}

interface InternalPluginsHost {
	internalPlugins?: {
		getPluginById?: (id: string) => {enabled?: boolean; instance?: {options?: DailyNoteOptions}} | undefined;
	};
}

// Reads the core Daily notes plugin settings (undocumented API, so everything is optional)
function getDailyNoteOptions(app: App): DailyNoteOptions {
	const plugin = (app as unknown as InternalPluginsHost).internalPlugins?.getPluginById?.('daily-notes');
	return plugin?.instance?.options ?? {};
}

async function readTemplate(app: App, templatePath: string | undefined): Promise<string> {
	if (!templatePath) return '';
	const path = templatePath.endsWith('.md') ? templatePath : `${templatePath}.md`;
	const file = app.vault.getAbstractFileByPath(normalizePath(path));
	return file instanceof TFile ? app.vault.read(file) : '';
}

async function ensureFolder(app: App, folder: string): Promise<void> {
	if (!folder || app.vault.getAbstractFileByPath(folder)) return;
	await app.vault.createFolder(folder);
}

/*
 * Opens the daily note for `dateStr` (YYYY-MM-DD), creating it if it doesn't exist.
 * Honors the core Daily notes plugin's folder, date format and template settings.
 */
export async function openDailyNote(app: App, dateStr: string): Promise<void> {
	try {
		const options = getDailyNoteOptions(app);
		const format = options.format?.trim() || 'YYYY-MM-DD';
		const folder = normalizePath(options.folder?.trim() || '/').replace(/^\/$/, '');
		const name = moment(dateStr, 'YYYY-MM-DD').format(format);
		const path = normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);

		const existing = app.vault.getAbstractFileByPath(path);
		let file: TFile;
		if (existing instanceof TFile) {
			file = existing;
		} else {
			const template = await readTemplate(app, options.template?.trim());
			const parent = path.substring(0, path.lastIndexOf('/'));
			await ensureFolder(app, parent);
			file = await app.vault.create(path, template);
		}
		await app.workspace.getLeaf(false).openFile(file);
	} catch (error) {
		console.error('Habit tracker: failed to open daily note', error);
		new Notice('Could not open the daily note.');
	}
}
