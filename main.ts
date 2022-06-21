import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, Workspace, MarkdownView, TFile } from 'obsidian';
import { exec } from "child_process";
import { promisify } from "util";
import * as CodeMirror from 'codemirror';

interface VimIMSwitchSettings {
	fcitxRemotePath_macOS: string;
	fcitxRemotePath_windows: string;
	fcitxRemotePath_linux: string;
}

const DEFAULT_SETTINGS: VimIMSwitchSettings = {
	fcitxRemotePath_macOS: '/usr/local/bin/fcitx-remote',
	fcitxRemotePath_windows: 'C:\\Program Files\\bin\\fcitx-remote',
	fcitxRemotePath_linux: '/usr/bin/fcitx-remote',
}

const pexec = promisify(exec);

enum IMStatus {
	None,
	Activate,
	Deactivate,
}

export default class VimIMSwitchPlugin extends Plugin {
	settings: VimIMSwitchSettings;
	imStatus = IMStatus.None;
	fcitxRemotePath = "";

	private editorMode: 'cm5' | 'cm6' = null;
	private initialized = false;
	private cmEditor: CodeMirror.Editor = null;

	async onload() {
		console.log('loading plugin VimIMSwitchPlugin.');

		await this.loadSettings();

		// this.addStatusBarItem().setText('Vim IM Swith Enabled');

		this.addSettingTab(new IMSwitchSettingTab(this.app, this));

		this.app.workspace.on('file-open', async (file: TFile) => {
			if (!this.initialized)
				await this.initialize();
				// {mode: string, ?subMode: string} object. Modes: "insert", "normal", "replace", "visual". Visual sub-modes: "linewise", "blockwise"}
				if (this.cmEditor) {
					// default is normal mode, try to deactivate the IM.
					await this.deactivateIM();
					this.cmEditor.on("vim-mode-change", this.onVimModeChange);
				}
		});

	}

	async initialize() {
		if (this.initialized)
			return;

		// Determine if we have the legacy Obsidian editor (CM5) or the new one (CM6).
		// This is only available after Obsidian is fully loaded, so we do it as part of the `file-open` event.
		if ('editor:toggle-source' in (this.app as any).commands.editorCommands) {
			this.editorMode = 'cm6';
			console.log('VimIMSwitchPlugin: using CodeMirror 6 mode');
		} else {
			this.editorMode = 'cm5';
			console.log('VimIMSwitchPlugin: using CodeMirror 5 mode');
		}

		// For CM6 this actually returns an instance of the object named CodeMirror from cm_adapter of codemirror_vim
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (this.editorMode == 'cm6')
			this.cmEditor = (view as any).sourceMode?.cmEditor?.cm?.cm;
		else
			this.cmEditor = (view as any).sourceMode?.cmEditor;

		this.initialized = true;
	}

	onVimModeChange = async (cm: any) => {
		if (cm.mode == "normal" || cm.mode == "visual") {
			await this.getFcitxRemoteStatus();
			if (this.imStatus == IMStatus.Activate) {
				await this.deactivateIM();
			}
		} else if (cm.mode == "insert" || cm.mode == "replace") {
			if (this.imStatus == IMStatus.Activate) {
				await this.activateIM();
			}
		}
	}

	async runCmd(cmd: string, args: string[] = []) : Promise<string>{
		const output = await pexec(`${cmd} ${args.join(" ")}`);
		return output.stdout;
	}

	async getFcitxRemoteStatus() {
		if (this.fcitxRemotePath == "") {
			console.log("VIM-IM-Switch-pugin: cannot get fcitx-remote path, please set it correctly.");
			return;
		}
		let fcitxRemoteOutput = await this.runCmd(this.fcitxRemotePath);
		fcitxRemoteOutput = fcitxRemoteOutput.trimRight();
		if (fcitxRemoteOutput == "1") {
			this.imStatus = IMStatus.Deactivate;
		} else if (fcitxRemoteOutput == "2") {
			this.imStatus = IMStatus.Activate;
		} else {
			this.imStatus = IMStatus.None;
		}
		console.log("Vim-IM-Swith-plugin: IM status " + this.imStatus.toString());
	}
	async activateIM() {
		if (this.fcitxRemotePath == "") {
			console.log("VIM-IM-Switch-pugin: cannot get fcitx-remote path, please set it correctly.");
			return;
		}
		const output = await this.runCmd(this.fcitxRemotePath, ["-o"]);
		console.log("Vim-IM-Swith-plugin: activate IM " + output);
	}
	async deactivateIM() {
		if (this.fcitxRemotePath == "") {
			console.log("VIM-IM-Switch-pugin: cannot get fcitx-remote path, please set it correctly.");
			return;
		}
		const output = await this.runCmd(this.fcitxRemotePath, ["-c"]);
		console.log("Vim-IM-Swith-plugin: deactivate IM " + output);
	}

	onunload() {
		if (this.cmEditor) {
			this.cmEditor.off("vim-mode-change", this.onVimModeChange);
		}
		console.log('unloading plugin VimIMSwitchPlugin.');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.updateCurrentPath();
	}

	async updateCurrentPath() {
		switch (process.platform) {
			case 'darwin':
				this.fcitxRemotePath = this.settings.fcitxRemotePath_macOS;
				break;
			case 'linux':
				this.fcitxRemotePath = this.settings.fcitxRemotePath_linux;
				break;
			case 'win32':
				this.fcitxRemotePath = this.settings.fcitxRemotePath_windows;
				break;
			default:
				console.log('VIM-IM-Switch-plugin: does not support ' + process.platform + ' currently.');
				break;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class IMSwitchSettingTab extends PluginSettingTab {
	plugin: VimIMSwitchPlugin;

	constructor(app: App, plugin: VimIMSwitchPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for Vim IM Switch plugin.'});

		new Setting(containerEl)
			.setName('Fcitx Remote Path for macOS')
			.setDesc('The absolute path to fcitx-remote bin file on macOS.')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.fcitxRemotePath_macOS)
				.setValue(this.plugin.settings.fcitxRemotePath_macOS)
				.onChange(async (value) => {
					this.plugin.settings.fcitxRemotePath_macOS = value;
					this.plugin.updateCurrentPath();
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Fcitx Remote Path for Linux')
			.setDesc('The absolute path to fcitx-remote bin file on Linux.')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.fcitxRemotePath_linux)
				.setValue(this.plugin.settings.fcitxRemotePath_linux)
				.onChange(async (value) => {
					this.plugin.settings.fcitxRemotePath_linux = value;
					this.plugin.updateCurrentPath();
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Fcitx Remote Path for Windows')
			.setDesc('The absolute path to fcitx-remote bin file on Windows.')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.fcitxRemotePath_windows)
				.setValue(this.plugin.settings.fcitxRemotePath_windows)
				.onChange(async (value) => {
					this.plugin.settings.fcitxRemotePath_windows = value;
					this.plugin.updateCurrentPath();
					await this.plugin.saveSettings();
				}));
	}
}
