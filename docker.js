import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import { getAbsolutePath, getAppPath, isWindows, getConfiguration } from './system.js';
import chalk from 'chalk';

export async function executeInContainer(containerId, command, streamGetter = null) {
    if (command.includes('"')) {
        return {
            output: '',
            stdout: '',
            stderr: '쌍따옴표는 허용되지 않습니다',
            code: 1,
            error: new Error('쌍따옴표는 허용되지 않습니다')
        };
    }
    return await executeCommand('' + (await getDockerCommand()) + ' exec "' + containerId + '" /bin/sh -c "' + command + '"', streamGetter)
}
async function getDockerCommand() {
    return 'docker';
    if (!commandDocker) commandDocker = await whereCommand('docker');
    return commandDocker;
}
async function getPowershellCommand() {
    if (!isWindows()) return '';
    if (!commandPowershell) commandPowershell = await whereCommand('powershell');
    return commandPowershell;
}

function parseCommandLine(cmdline) {
    let args = [];
    let currentArg = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escapeNext = false;

    for (let i = 0; i < cmdline.length; i++) {
        let c = cmdline[i];

        if (escapeNext) {
            currentArg += c;
            escapeNext = false;
        } else if (c === '\\' && !inSingleQuote) {
            escapeNext = true;
        } else if (c === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            // Do not include the quote in the argument
        } else if (c === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            // Do not include the quote in the argument
        } else if (/\s/.test(c) && !inSingleQuote && !inDoubleQuote) {
            if (currentArg.length > 0) {
                args.push(currentArg);
                currentArg = '';
            }
        } else {
            currentArg += c;
        }
    }

    if (escapeNext) {
        throw new Error('Invalid command line: Ends with a single backslash');
    }

    if (inSingleQuote || inDoubleQuote) {
        throw new Error('Invalid command line: Mismatched quotes');
    }

    if (currentArg.length > 0) {
        args.push(currentArg);
    }

    if (args.length === 0) {
        throw new Error('No command found');
    }

    let command = args.shift();
    return { command, args };
}

export function executeCommandSync(command, args = []) {
    const result = spawnSync(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
        shell: true
    });

    return {
        output: result.stderr + '\n\n' + result.stdout,
        stdout: result.stdout,
        stderr: result.stderr,
        code: result.status,
        error: result.error
    };
}
let commandPowershell;
let commandDocker;
export async function executeCommand(command, streamGetter = null) {
    const khongLog = true;
    return new Promise(async (resolve, reject) => {
        let result;
        if (!isWindows()) result = parseCommandLine(command);
        if (isWindows()) result = {
            command: await getPowershellCommand(),
            args: ['-Command', command]
        }
        const child = spawn(result.command, result.args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false
        });
        let stdout = '';
        let stderr = '';
        let output = '';
        const broadCaster = (str, type) => {
            if (!streamGetter) return;
            if (streamGetter.constructor !== Function) return;
            // if (type === 'stdout') str = chalk.hex('#aaaaaa')(str);
            if (type === 'stdout') str = chalk.hex('#c4ff78')(str);
            if (type === 'stderr') str = chalk.hex('#ff7700')(str);
            // console.log('tpaaa', type, str);
            streamGetter(str);
        }

        child.stdout.on('data', (data) => {
            if (!khongLog) console.log('execution_stdout', data.toString());
            const str = data.toString();
            stdout += str;
            output += str;
            broadCaster(str, 'stdout');
        });

        child.stderr.on('data', (data) => {
            if (!khongLog) console.log('execution_stderr', data.toString());
            const str = data.toString();
            stderr += str;
            output += str;
            broadCaster(str, 'stderr');
        });

        child.on('error', (error) => {
            if (!khongLog) console.log('execution_error', error);
            reject(error);
        });
        child.on('exit', (code) => {
            if (!khongLog) console.log('execution_exit', code);
        });

        child.on('close', (code) => {
            if (!khongLog) console.log('execution_close', code);
            resolve({
                stdout,
                stderr,
                output,
                code,
                error: code !== 0 ? new Error('Command failed') : null
            });
        });
    });
}

export async function importToDocker(containerId, workDir, inputDir) {
    let result = await executeInContainer(containerId, 'mkdir -p ' + workDir);
    if (result.code !== 0) throw new Error('작업 디렉토리 생성 실패');

    result = await executeCommand('' + (await getDockerCommand()) + ' cp "' + inputDir + '/." "' + containerId + ':' + workDir + '"');
    if (result.code !== 0) throw new Error('input 폴더 복사 실패');
}

export async function exportFromDocker(containerId, workDir, outputDir) {
    const prefixName = 'AIAGENT-data-handling-';
    const removeList = [
        'node_modules', '.git', '.vscode',
        'AIAGENT-data-handling-tmpfile.tar',
        'AIAGENT-data-handling-exportData.js',
        'AIAGENT-data-handling-operation.js',
        'package-lock.json', 'package.json'
    ];

    let result;

    for (const item of removeList) {
        result = await executeInContainer(containerId, `rm -rf ${workDir}/${item}`);
        if (result.code !== 0) throw new Error(`${item} 삭제 실패`);
    }

    result = await executeInContainer(containerId, `rm -rf ${workDir}/${prefixName}*`);
    if (result.code !== 0) throw new Error('임시 파일 삭제 실패');


    result = await executeCommand('' + (await getDockerCommand()) + ' cp "' + containerId + ':' + workDir + '/." "' + outputDir + '"');
    if (result.code !== 0) throw new Error('output 폴더로 복사 실패');
}

export async function initNodeProject(containerId, workDir) {
    if (npmInit) return;
    npmInit = true;
    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && npm init -y');
}

const installNPMHistory = {};
let npmInit = false;
const installPIPHistory = {};
let pipInit = false;
export function isInstalledNodeModule(moduleName) {
    return !!installNPMHistory[moduleName.toLowerCase()];
}
export async function installNodeModules(containerId, workDir, moduleName) {
    moduleName = moduleName.trim();
    if (!moduleName) return;
    await initNodeProject(containerId, workDir);
    if (!isInstalledNodeModule(moduleName)) {
        installNPMHistory[moduleName.toLowerCase()] = true;
        let result = await executeInContainer(containerId, 'cd ' + workDir + ' && npm install ' + moduleName + '');
        return true;
    }
}
export async function isInstalledPythonModule(containerId, workDir, moduleName) {
    let piplist = await executeInContainer(containerId, 'cd ' + workDir + ' && pip show ' + moduleName + '');
    return (!!piplist.stdout.trim()) && piplist.code === 0;
}
export async function initPythonProject(containerId, workDir) {
    if (pipInit) return;
    pipInit = true;
    false && await executeInContainer(containerId, 'cd ' + workDir + ' && pip install --upgrade pip');
}
export async function installPythonModules(containerId, workDir, moduleName) {
    moduleName = moduleName.trim();
    if (!moduleName) return;
    await initPythonProject(containerId, workDir);
    if (!await isInstalledPythonModule(containerId, workDir, moduleName)) {
        installPIPHistory[moduleName.toLowerCase()] = true;
        let result = await executeInContainer(containerId, 'cd ' + workDir + ' && pip install ' + moduleName + '');
        return true;
    }
}
export async function runPythonCode(containerId, workDir, code, requiredPackageNames = [], streamGetter = null) {
    for (const packageName of requiredPackageNames) await installPythonModules(containerId, workDir, packageName);
    const tmpPyFile = getAppPath('.code_' + Math.random() + '.py');
    const pyFileName = 'AIAGENT-data-handling-operation.py';

    code = [
        `import os`,
        `os.remove('${pyFileName}')`,
        code
    ].join('\n');

    await fs.promises.writeFile(tmpPyFile, code);

    {
        let result = await executeCommand('' + (await getDockerCommand()) + ' cp "' + tmpPyFile + '" "' + containerId + ':' + workDir + '/' + pyFileName + '"');

        if (result.code !== 0) throw new Error('임시 PY 파일 복사 실패');
    }
    await fs.promises.rm(tmpPyFile);


    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && python -u ' + pyFileName, streamGetter);
    result.output = `${result.stderr}\n\n${result.stdout}`;
    return result;

}
export async function runNodeJSCode(containerId, workDir, code, requiredPackageNames = [], streamGetter = null) {
    for (const packageName of requiredPackageNames) await installNodeModules(containerId, workDir, packageName);
    const tmpJsFile = getAppPath('.code_' + Math.random() + '.js');
    const jsFileName = 'AIAGENT-data-handling-operation.js';

    code = [
        `{`,
        `const fs = require('fs');`,
        `fs.rmSync('${jsFileName}', { recursive: true, force: true });`,
        `}`,
        code
    ].join('\n');

    await fs.promises.writeFile(tmpJsFile, code);

    {
        let result = await executeCommand('' + (await getDockerCommand()) + ' cp "' + tmpJsFile + '" "' + containerId + ':' + workDir + '/' + jsFileName + '"');

        if (result.code !== 0) throw new Error('임시 JS 파일 복사 실패');
    }
    await fs.promises.rm(tmpJsFile);


    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && node ' + jsFileName, streamGetter);
    result.output = `${result.stderr}\n\n${result.stdout}`;
    return result;
}
export async function killDockerContainer(containerId) {
    await executeCommand(`${await getDockerCommand()} kill "${containerId}"`);
}
export async function runDockerContainerDemon(dockerImage) {
    let result = await executeCommand(`${await getDockerCommand()} run -d --rm --platform linux/x86_64 "${dockerImage}" tail -f /dev/null`);
    if (result.code !== 0) throw new Error('컨테이너 시작 실패');
    return result.stdout.trim();
}

export async function runDockerContainer(dockerImage, inputDir, outputDir) {
    const containerId = await runDockerContainerDemon(dockerImage);
    const dockerWorkDir = await getConfiguration('dockerWorkDir');
    const workDir = dockerWorkDir;

    try {
        await importToDocker(containerId, workDir, inputDir);
        await initNodeProject(containerId, workDir);
        await installNodeModules(containerId, workDir, 'express');
        await runNodeJSCode(containerId, workDir, `console.log('Hello, World!');`);
        await exportFromDocker(containerId, workDir, outputDir);
    } finally {
        await killDockerContainer(containerId);
    }
}


export async function doesDockerImageExist(imageName) {
    try {
        if (!imageName) return false;
        if (imageName.includes('"')) return false;
        const result = await executeCommand(`${await getDockerCommand()} images --format '{{json .}}'`);
        if (result.code !== 0) return false;
        const images = result.stdout.split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));

        return images.some(image => image.Repository === imageName);
    } catch (err) {
        return false;
    }
}

































export async function whereCommand(name) {
    const execAsync = promisify(exec);
    const commands = isWindows() ? [
        `Where.exe ${name}`,
        `Where.exe ${name}.exe`,
    ] : [
        `which ${name}`,
    ];
    for (const command of commands) {
        const result = await execAsync(command);
        let picked = result?.stdout?.trim();
        if (!picked) picked = '';
        picked = picked.trim();
        picked = picked.split('\n')[0];
        picked = picked.trim();
        if (picked) {
            return picked;
        }
    }
    return name;
}


async function runCommandWithTimeout(command, timeoutMs = 10000) {
    const execAsync = promisify(exec);
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Command timed out after ${timeoutMs / 1000} seconds`)), timeoutMs)
    );
    const executionPromise = (async () => {
        return await execAsync(command);
    })();
    return await Promise.race([executionPromise, timeoutPromise]);
}


export async function getDockerInfo() {
    try {
        const execAsync = promisify(exec);
        let command = `${await getDockerCommand()}` + " info --format '{{json .}}' 2>/dev/null";
        if (isWindows()) command = `${await getDockerCommand()}` + " info --format '{{json .}}'";
        if (isWindows()) command = `"${await getPowershellCommand()}" -Command "${command}"`;

        let result;
        if (!isWindows()) {
            result = await execAsync(command);
        } else {
            try { result = await runCommandWithTimeout(command); } catch { }
        }
        let stdout = result?.stdout;
        if (!stdout) {
            throw new Error('도커 정보를 가져올 수 없습니다.');
        }
        const dockerInfo = JSON.parse(stdout);
        const isRunning = !dockerInfo.ServerErrors || dockerInfo.ServerErrors.length === 0;
        return {
            ...dockerInfo,
            isRunning
        };
    } catch (error) {
        return {
            isRunning: false,
            error: error.message
        };
    }
}
