import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { exec } from "child_process";
import { promisify } from "util";

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
	cm: CodeMirror.Editor;
	imStatus = IMStatus.None;
	fcitxRemotePath = "";

	async onload() {
		console.log('loading plugin VimIMSwitchPlugin.');

		await this.loadSettings();

		// this.addStatusBarItem().setText('Vim IM Swith Enabled');

		this.addSettingTab(new IMSwitchSettingTab(this.app, this));

		this.registerCodeMirror((cmEditor: CodeMirror.Editor) => {
			this.cm = cmEditor;
			// {mode: string, ?subMode: string} object. Modes: "insert", "normal", "replace", "visual". Visual sub-modes: "linewise", "blockwise"}
			this.cm.on("vim-mode-change", async (cm:any) => {
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
			});
		});
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
		console.log('unloading plugin VimIMSwitchPlugin.');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
		await this.loadSettings();
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
					await this.plugin.saveSettings();
				}));
	}
}
