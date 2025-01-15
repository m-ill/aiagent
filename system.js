import net from 'net';
import chalk from 'chalk';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import os from 'os';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getHomeDir() {
    return os.homedir();
}
export function getHomePath(itemPath) {
    return path.join(getHomeDir(), itemPath);
}
export function getConfigFilePath() {
    const folder = getHomePath('.aiagent');
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    return path.join(folder, '.aiagent.cokac.config.json');
}

export async function setConfiguration(key, value) {
    const configPath = getConfigFilePath();
    const config = await loadConfiguration();
    try {
        value = JSON.parse(value);
    } catch { }
    config[key] = value;
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
}
export async function getConfiguration(key) {
    const config = await loadConfiguration();
    return config[key];
}
export async function loadConfiguration() {
    let config = {
        claudeApiKey: "",
        model: "claude-3-5-haiku-20241022",
        llm: "claude",
        maxIterations: 0,
        dockerImage: 'my-node-ubuntu',
        useDocker: true, // Docker 사용 여부 (false: 도커 아닌 웹컨테이너 사용, true: 도커 사용함)
        dockerWorkDir: '/home/ubuntu/work',
        overwriteOutputDir: false, // 덮어쓰기 여부 (false: 덮어쓰지 않음, true: 덮어씀)
    }
    let config_ = {};
    try {
        const configPath = getConfigFilePath();
        const data = await fs.promises.readFile(configPath, 'utf8');
        config_ = JSON.parse(data);
        if (!config_ || (config_ && config_.constructor !== Object)) config_ = {};
    } catch { }
    for (let key in config) {
        if (!config_[key]) config_[key] = config[key];
    }
    return config_;
}
export async function getToolList() {
    const useDocker = await getConfiguration('useDocker');
    const container = useDocker ? 'docker' : 'webcontainer';
    const toolList = await fs.promises.readdir(getCodePath(`prompt_tools/${container}`));
    return toolList.filter(tool => tool.endsWith('.toolspec.json')).map(tool => tool.replace(/\.toolspec\.json$/, ''));
}
export async function getToolData(toolName) {
    const useDocker = await getConfiguration('useDocker');
    const container = useDocker ? 'docker' : 'webcontainer';
    const toolPrompt = getCodePath(`prompt_tools/${container}/${toolName}.md`);
    const toolSpecPath = getCodePath(`prompt_tools/${container}/${toolName}.toolspec.json`);
    const toolSpec = await fs.promises.readFile(toolSpecPath, 'utf8');
    const prompt = await fs.promises.readFile(toolPrompt, 'utf8');
    return {
        prompt,
        spec: JSON.parse(toolSpec)
    };
}
export function getCodePath(itemPath) {
    return getAbsolutePath(path.join(__dirname, itemPath));
}
export function getAppPath(itemPath) {
    const workspace = getHomePath('.aiagent/workspace');
    if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true });
    return getAbsolutePath(path.join(workspace, itemPath));
}
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}
export async function findAvailablePort(startPort) {

    let port = startPort;
    while (!(await isPortAvailable(port))) {
        port++;
        if (port > 65535) {
            throw new Error('No available ports found.');
        }
    }
    return port;
}
export function getAbsolutePath(itemPath) {
    if (!itemPath) return;
    if (!path.isAbsolute(itemPath)) {
        return path.join(process.cwd(), itemPath);
    }
    return itemPath;
}
export async function flushFolder(folderList) {
    for (const folder of folderList) {
        try {
            const files = await fs.promises.readdir(folder);
            if (files.length === 0) await fs.promises.rmdir(folder);
        } catch (error) { }
    }
}
export function validatePath(path, pathType) {
    const invalidChars = isWindows() ? ['"', "'"] : ['"', "'", ' '];
    if (invalidChars.some(char => path.includes(char))) {
        if (isWindows()) {
            console.log(chalk.red(`${pathType} 경로에는 작은따옴표('), 큰따옴표(")를 사용할 수 없습니다.`));
        } else {
            console.log(chalk.red(`${pathType} 경로에는 공백(" "), 작은따옴표('), 큰따옴표(")를 사용할 수 없습니다.`));
        }
        process.exit(1);
    }
}
export function getOS() {
    return process.platform;
}
export function isWindows() {
    return getOS() === 'win32';
}
export function getOSPathSeparator() {
    return isWindows() ? '\\' : '/';
}

export async function prepareOutputDir(outputDir, overwrite, doNotCreate = false) {
    // 끝의 모든 슬래시 제거
    let baseDir = outputDir;
    while (baseDir.endsWith('/') || baseDir.endsWith('\\')) {
        baseDir = baseDir.slice(0, -1).trim();
    }

    // 사용 가능한 디렉토리명 찾기
    let targetDir = baseDir;
    if (!overwrite) {
        let suffix = 1;

        while (fs.existsSync(targetDir)) {
            targetDir = `${baseDir}_${suffix++}`;
        }

        // 디렉토리 생성
        if (!doNotCreate) await fs.promises.mkdir(targetDir, { recursive: true });
        return targetDir;
    } else {
        await fs.promises.rm(targetDir, { recursive: true, force: true });
        if (!doNotCreate) await fs.promises.mkdir(targetDir, { recursive: true });
        return targetDir;
    }
}


export function convertJsonToResponseFormat(struct, descriptions = {}) {
    const getType = (value) => {
        if (value === null) return "null";
        if (Array.isArray(value)) return "array";
        if (typeof value === "boolean") return "boolean";
        if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
        if (typeof value === "string") return "string";
        if (typeof value === "object") return "object";
        return "unknown";
    };

    const generateSchema = (data, desc) => {
        const dataType = getType(data);
        let schema = {};

        if (dataType === "object") {
            const properties = {};
            const required = [];
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    const propertyDesc = desc && desc[key] ? desc[key] : {};
                    properties[key] = generateSchema(data[key], propertyDesc);
                    required.push(key);
                }
            }
            schema = {
                type: "object",
                properties: properties,
                required: required
            };
        } else if (dataType === "array") {
            if (data.length === 0) {
                schema = { type: "array", items: {} };
            } else {
                const itemSchemas = data.map(item => generateSchema(item, desc));
                const firstItemSchemaStr = JSON.stringify(itemSchemas[0]);
                const allSame = itemSchemas.every(
                    itemSchema => JSON.stringify(itemSchema) === firstItemSchemaStr
                );
                schema = {
                    type: "array",
                    items: allSame ? itemSchemas[0] : {}
                };
            }
        } else {
            schema = { type: dataType };
        }

        // Add description if provided
        if (desc && typeof desc === 'string') {
            schema.description = desc;
        }

        return schema;
    };

    const schema = generateSchema(struct, descriptions);
    schema["$schema"] = "http://json-schema.org/draft-07/schema#";
    schema["additionalProperties"] = false;

    return {
        type: "json_schema",
        json_schema: {
            name: "response",
            schema: schema,
            strict: true
        }
    };
}
