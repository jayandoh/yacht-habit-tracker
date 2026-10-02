import {App, Notice, TFile, moment, normalizePath} from 'obsidian';
import {CreateDailyNoteModal} from './ui/CreateDailyNoteModal';

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

async function createAndOpen(app: App, path: string, options: DailyNoteOptions): Promise<void> {
	try {
		const template = await readTemplate(app, options.template?.trim());
		await ensureFolder(app, path.substring(0, path.lastIndexOf('/')));
		const file = await app.vault.create(path, template);
		await app.workspace.getLeaf(false).openFile(file);
	} catch (error) {
		console.error('Habit tracker: failed to create daily note', error);
		new Notice('Could not create the daily note.');
	}
}

/*
 * Opens the daily note for `dateStr` (YYYY-MM-DD). If it doesn't exist, asks the user
 * whether to create it first.
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
		if (existing instanceof TFile) {
			await app.workspace.getLeaf(false).openFile(existing);
			return;
		}
		new CreateDailyNoteModal(app, () => createAndOpen(app, path, options)).open();
	} catch (error) {
		console.error('Habit tracker: failed to open daily note', error);
		new Notice('Could not open the daily note.');
	}
}
