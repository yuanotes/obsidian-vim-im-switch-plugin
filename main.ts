import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { exec } from "child_process";
import { promisify } from "util";

interface VimIMSwitchSettings {
	fcitxRemotePath: string;
}

const DEFAULT_SETTINGS: VimIMSwitchSettings = {
	fcitxRemotePath: '/usr/local/bin/fcitx-remote',
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
		let fcitxRemoteOutput = await this.runCmd(this.settings.fcitxRemotePath);
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
		const output = await this.runCmd(this.settings.fcitxRemotePath, ["-o"]);
		console.log("Vim-IM-Swith-plugin: activate IM " + output);
	}
	async deactivateIM() {
		const output = await this.runCmd(this.settings.fcitxRemotePath, ["-c"]);
		console.log("Vim-IM-Swith-plugin: deactivate IM " + output);
	}

	onunload() {
		console.log('unloading plugin VimIMSwitchPlugin.');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
			.setName('Fcitx Remote Path')
			.setDesc('The absolute path to fcitx-remote bin file.')
			.addText(text => text
				.setPlaceholder('/usr/local/bin/fcitx-remote')
				.setValue('/usr/local/bin/fcitx-remote')
				.onChange(async (value) => {
					this.plugin.settings.fcitxRemotePath = value;
					await this.plugin.saveSettings();
				}));
	}
}
