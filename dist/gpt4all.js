"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GPT4All = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const axios_1 = __importDefault(require("axios"));
const progress_1 = __importDefault(require("progress"));
class GPT4All {
    constructor(model = 'gpt4all-lora-quantized', forceDownload = false, decoderConfig = {}) {
        this.bot = null;
        this.model = model;
        this.decoderConfig = decoderConfig;
        /*
        allowed models:
        M1 Mac/OSX: cd chat;./gpt4all-lora-quantized-OSX-m1
    Linux: cd chat;./gpt4all-lora-quantized-linux-x86
    Windows (PowerShell): cd chat;./gpt4all-lora-quantized-win64.exe
    Intel Mac/OSX: cd chat;./gpt4all-lora-quantized-OSX-intel
        */
        if ('ggml-gpt4all-j' !== model &&
            'gpt4all-lora-quantized' !== model &&
            'gpt4all-lora-unfiltered-quantized' !== model) {
            throw new Error(`Model ${model} is not supported. Current models supported are: 
                gpt4all-lora-quantized
                gpt4all-lora-unfiltered-quantized`);
        }
        this.executablePath = path_1.default.normalize(`${__dirname}/../.nomic/gpt4all-lora-quantized-win64.exe`);
        this.modelPath = path_1.default.normalize(`${__dirname}/../.nomic/${model}.bin`);
        // this.executablePath = `${os.homedir()}/.nomic/gpt4all`;
        // this.modelPath = `${os.homedir()}/.nomic/${model}.bin`; 
    }
    async init(forceDownload = false) {
        const downloadPromises = [];
        if (forceDownload || !fs_1.default.existsSync(this.executablePath)) {
            downloadPromises.push(this.downloadExecutable());
        }
        if (forceDownload || !fs_1.default.existsSync(this.modelPath)) {
            downloadPromises.push(this.downloadModel());
        }
        await Promise.all(downloadPromises);
    }
    async open() {
        if (this.bot !== null) {
            this.close();
        }
        let spawnArgs = [this.executablePath, '--model', this.modelPath];
        for (let [key, value] of Object.entries(this.decoderConfig)) {
            spawnArgs.push(`--${key}`, value.toString());
        }
        this.bot = (0, child_process_1.spawn)(spawnArgs[0], spawnArgs.slice(1), { stdio: ['pipe', 'pipe', 'ignore'] });
        // wait for the bot to be ready
        await new Promise((resolve) => {
            this.bot?.stdout?.on('data', (data) => {
                if (data.toString().includes('>')) {
                    resolve(true);
                }
            });
        });
    }
    close() {
        if (this.bot !== null) {
            this.bot.kill();
            this.bot = null;
        }
    }
    async downloadExecutable() {
        let upstream;
        const platform = os_1.default.platform();
        if (platform === 'darwin') {
            // check for M1 Mac
            const { stdout } = await (0, util_1.promisify)(child_process_1.exec)('uname -m');
            if (stdout.trim() === 'arm64') {
                upstream = 'https://github.com/nomic-ai/gpt4all/blob/main/chat/gpt4all-lora-quantized-OSX-m1?raw=true';
            }
            else {
                upstream = 'https://github.com/nomic-ai/gpt4all/blob/main/chat/gpt4all-lora-quantized-OSX-intel?raw=true';
            }
        }
        else if (platform === 'linux') {
            upstream = 'https://github.com/nomic-ai/gpt4all/blob/main/chat/gpt4all-lora-quantized-linux-x86?raw=true';
        }
        else if (platform === 'win32') {
            upstream = 'https://github.com/nomic-ai/gpt4all/blob/main/chat/gpt4all-lora-quantized-win64.exe?raw=true';
        }
        else {
            throw new Error(`Your platform is not supported: ${platform}. Current binaries supported are for OSX (ARM and Intel), Linux and Windows.`);
        }
        await this.downloadFile(upstream, this.executablePath);
        await fs_1.default.chmod(this.executablePath, 0o755, (err) => {
            if (err) {
                throw err;
            }
        });
        console.log(`File downloaded successfully to ${this.executablePath}`);
    }
    async downloadModel() {
        const modelUrl = `https://the-eye.eu/public/AI/models/nomic-ai/gpt4all/${this.model}.bin`;
        await this.downloadFile(modelUrl, this.modelPath);
        console.log(`File downloaded successfully to ${this.modelPath}`);
    }
    async downloadFile(url, destination) {
        const { data, headers } = await axios_1.default.get(url, { responseType: 'stream' });
        const totalSize = parseInt(headers['content-length'], 10);
        const progressBar = new progress_1.default('[:bar] :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: totalSize,
        });
        const dir = new URL(`file://${os_1.default.homedir()}/.nomic/`);
        await fs_1.default.mkdir(dir, { recursive: true }, (err) => {
            if (err) {
                throw err;
            }
        });
        const writer = fs_1.default.createWriteStream(destination);
        data.on('data', (chunk) => {
            progressBar.tick(chunk.length);
        });
        data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }
    prompt(prompt) {
        if (this.bot === null) {
            throw new Error("Bot is not initialized.");
        }
        this.bot.stdin.write(prompt + "\n");
        return new Promise((resolve, reject) => {
            let response = "";
            let timeoutId;
            const onStdoutData = (data) => {
                const text = data.toString();
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                if (text.includes(">")) {
                    // console.log('Response starts with >, end of message - Resolving...'); // Debug log: Indicate that the response ends with "\\f"
                    terminateAndResolve(response); // Remove the trailing "\f" delimiter
                }
                else {
                    timeoutId = setTimeout(() => {
                        // console.log('Timeout reached - Resolving...'); // Debug log: Indicate that the timeout has been reached
                        terminateAndResolve(response);
                    }, 4000); // Set a timeout of 4000ms to wait for more data
                }
                // console.log('Received text:', text); // Debug log: Show the received text
                response += text;
                // console.log('Updated response:', response); // Debug log: Show the updated response
            };
            const onStdoutError = (err) => {
                this.bot.stdout.removeListener("data", onStdoutData);
                this.bot.stdout.removeListener("error", onStdoutError);
                reject(err);
            };
            const terminateAndResolve = (finalResponse) => {
                this.bot.stdout.removeListener("data", onStdoutData);
                this.bot.stdout.removeListener("error", onStdoutError);
                // check for > at the end and remove it
                if (finalResponse.endsWith(">")) {
                    finalResponse = finalResponse.slice(0, -1);
                }
                resolve(finalResponse);
            };
            this.bot.stdout.on("data", onStdoutData);
            this.bot.stdout.on("error", onStdoutError);
        });
    }
}
exports.GPT4All = GPT4All;
//# sourceMappingURL=gpt4all.js.map