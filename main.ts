import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, Workspace, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import { exec } from "child_process";
import { promisify } from "util";
import * as CodeMirror from 'codemirror';

interface VimIMSwitchSettings {
	fcitxRemotePath_macOS: string;
	fcitxRemotePath_windows: string;
	fcitxRemotePath_linux: string;
	IMSwitch_when_insert_mode: boolean;
	IMSwitch_developer_logging: boolean;
}

const DEFAULT_SETTINGS: VimIMSwitchSettings = {
	fcitxRemotePath_macOS: '/usr/local/bin/fcitx-remote',
	fcitxRemotePath_windows: 'C:\\Program Files\\bin\\fcitx-remote',
	fcitxRemotePath_linux: '/usr/bin/fcitx-remote',
	IMSwitch_when_insert_mode: true,
	IMSwitch_developer_logging: false,
}

const pexec = promisify(exec);

enum IMStatus {
	Unknown = "Unknown",
	Active = "Active",
	Inactive = "Inactive",
}

export default class VimIMSwitchPlugin extends Plugin {
	settings: VimIMSwitchSettings;
	imStatus = IMStatus.Unknown;
	fcitxRemotePath = "";

	private initialized = false;
	private cmEditor: CodeMirror.Editor = null;

	debug_log(content: any) {
		if (this.settings?.IMSwitch_developer_logging) {
			console.log(content);
		}
	}

	async onload() {
		console.log('Vim Input Method Switch: loading plugin');

		await this.loadSettings();

		// this.addStatusBarItem().setText('Vim IM Switch Enabled');

		this.addSettingTab(new IMSwitchSettingTab(this.app, this));

		this.app.workspace.on('quit', async () => {
			await this.deactivateIM();
		});

		this.app.workspace.on('file-open', async (file: TFile) => {
			this.debug_log("Vim Input Method Switch: file-open")
			if (!this.initialized && file)
				await this.initialize();
				// {mode: string, ?subMode: string} object. Modes: "insert", "normal", "replace", "visual". Visual sub-modes: "linewise", "blockwise"}
				if (this.cmEditor) {
					// default is normal mode, try to deactivate the IM.
					await this.deactivateIM();
					if (this.imStatus == IMStatus.Unknown) {
						await this.getFcitxRemoteStatus();
					}
					this.cmEditor.off("vim-mode-change", this.onVimModeChange);
					this.cmEditor.on("vim-mode-change", this.onVimModeChange);
				}
		});

		// Used when we open a new markdown view by "split vertically",
		// which will not trigger 'file-open' event on obsidian v0.15.6
		this.app.workspace.on('active-leaf-change', async (leaf: WorkspaceLeaf) => {
			this.debug_log("Vim Input Method Switch: active-leaf-change")
			if(this.app.workspace.activeLeaf.view.getViewType() == "markdown") {
				this.debug_log("Vim Input Method Switch: focus on markdown view")
				if (!this.initialized)
					await this.initialize();
				// {mode: string, ?subMode: string} object. Modes: "insert", "normal", "replace", "visual". Visual sub-modes: "linewise", "blockwise"}
				if (this.cmEditor) {
					// default is normal mode, try to deactivate the IM.
					await this.deactivateIM();
					if (this.imStatus == IMStatus.Unknown) {
						await this.getFcitxRemoteStatus();
					}
					this.cmEditor.off("vim-mode-change", this.onVimModeChange);
					this.cmEditor.on("vim-mode-change", this.onVimModeChange);
				}
			}
		});
	}

	async initialize() {
		if (this.initialized) {
			return;
		}

		this.debug_log("Vim Input Method Switch: initializing")

		// For CM6 this actually returns an instance of the object named CodeMirror from cm_adapter of codemirror_vim
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		this.cmEditor = (view as any).sourceMode?.cmEditor?.cm?.cm;

		// on Obsidian v0.15.6, we can't reuse cmEditor got at the beginning of application
		// we need to get cmEditor again for every 'file-open'
		// and every 'split vertically' and every 'split horizontally'
		// this.initialized = true;
	}

	onVimModeChange = async (cm: any) => {
		// this.debug_log("Vim Input Method Switch: Vim mode change to : " + cm.mode);

		if (cm.mode == "normal" || cm.mode == "visual") {
			await this.getFcitxRemoteStatus();
			if (this.imStatus == IMStatus.Active) {
				await this.deactivateIM();
			}
		} else if (cm.mode == "insert" || cm.mode == "replace") {
			if (this.imStatus == IMStatus.Inactive && this.settings.IMSwitch_when_insert_mode == true) {
				await this.activateIM();
			}
		}
	}

	async runCmd(cmd: string, args: string[] = []) : Promise<string> {
		const output = await pexec(`${cmd} ${args.join(" ")}`);
		return output.stdout || output.stderr;
	}

	async getFcitxRemoteStatus() {
		if (this.fcitxRemotePath == "") {
			this.debug_log("Vim Input Method Switch: cannot get fcitx-remote path, please set it correctly.");
			return;
		}
		let fcitxRemoteOutput = await this.runCmd(this.fcitxRemotePath);
		fcitxRemoteOutput = fcitxRemoteOutput.trimRight();
		if (fcitxRemoteOutput == "1") {
			this.imStatus = IMStatus.Inactive;
		} else if (fcitxRemoteOutput == "2") {
			this.imStatus = IMStatus.Active;
		} else {
			this.imStatus = IMStatus.Unknown;
		}
		this.debug_log("Vim Input Method Switch: input method status: " + this.imStatus.toString());
	}

	async activateIM() {
		if (this.fcitxRemotePath == "") {
			this.debug_log("Vim Input Method Switch: cannot get fcitx-remote path, please set it correctly.");
			return;
		}
		const output = await this.runCmd(this.fcitxRemotePath, ["-o"]);
		this.debug_log("Vim Input Method Switch: activate input method: " + output);

		if (/Changing to/gi.test(output)) { // https://github.com/xcodebuild/fcitx-remote-for-osx/blob/master/fcitx-remote/main.m#L95
			this.imStatus = IMStatus.Inactive;
			this.debug_log("Vim Input Method Switch: input method status: " + this.imStatus.toString());
		}
	}

	async deactivateIM() {
		if (this.fcitxRemotePath == "") {
			this.debug_log("Vim Input Method Switch: cannot get fcitx-remote path, please set it correctly.");
			return;
		}
		const output = await this.runCmd(this.fcitxRemotePath, ["-c"]);
		this.debug_log("Vim Input Method Switch: deactivate input method: " + output);

		if (/Changing to/gi.test(output)) { // https://github.com/xcodebuild/fcitx-remote-for-osx/blob/master/fcitx-remote/main.m#L95
			this.imStatus = IMStatus.Inactive;
			this.debug_log("Vim Input Method Switch: input method status: " + this.imStatus.toString());
		}
	}

	onunload() {
		if (this.cmEditor) {
			this.cmEditor.off("vim-mode-change", this.onVimModeChange);
		}
		this.debug_log('Vim Input Method Switch: unloading plugin');
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
				console.log('Vim Input Method Switch: does not support ' + process.platform + ' currently.');
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
		new Setting(containerEl)
			.setName('Auto switch input method when entering insert or replace mode')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.IMSwitch_when_insert_mode)
				.onChange((value) => {
					this.plugin.settings.IMSwitch_when_insert_mode = value;
					this.plugin.updateCurrentPath();
					this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Toggle developer logging')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.IMSwitch_developer_logging)
				.onChange((value) => {
					this.plugin.settings.IMSwitch_developer_logging = value;
					this.plugin.updateCurrentPath();
					this.plugin.saveSettings();
				}));
	}
}
