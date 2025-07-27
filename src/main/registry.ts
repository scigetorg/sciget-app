import { execFile, ExecFileOptions, execFileSync } from 'child_process';
import { basename, join, normalize } from 'path';
import * as path from 'path';
import * as semver from 'semver';
import * as fs from 'fs';
import log from 'electron-log';
const WinRegistry = require('winreg');
import { ISignal, Signal } from '@lumino/signaling';
import {
  EnvironmentTypeName,
  IDisposable,
  IEnvironmentType,
  IPythonEnvironment,
  IVersionContainer
} from './tokens';
import { getUserHomeDir, versionWithoutSuffix } from './utils';
import { appData } from './config/appdata';

const envInfoPyCode = fs
  .readFileSync(path.join(__dirname, 'env_info.py'))
  .toString();

export interface IRegistry {
  getDefaultEnvironment: () => Promise<IPythonEnvironment>;
  getEnvironmentByPath: (pythonPath: string) => IPythonEnvironment;
  getEnvironmentList: (cacheOK: boolean) => Promise<IPythonEnvironment[]>;
  condaRootPath: Promise<string>;
  setCondaRootPath(rootPath: string): void;
  addEnvironment: (pythonPath: string) => IPythonEnvironment;
  validatePythonEnvironmentAtPath: (pythonPath: string) => boolean;
  validateCondaBaseEnvironmentAtPath: (envPath: string) => boolean;
  setDefaultPythonPath: (pythonPath: string) => void;
  getCurrentPythonEnvironment: () => IPythonEnvironment;
  getAdditionalPathIncludesForPythonPath: (pythonPath: string) => string;
  getRequirements: () => Registry.IRequirement[];
  getEnvironmentInfo(pythonPath: string): Promise<IPythonEnvironment>;
  getRunningServerList(): Promise<string[]>;
  getRunningStorageServerList(): Promise<string[]>;
  dispose(): Promise<void>;
  environmentListUpdated: ISignal<this, void>;
  clearUserSetPythonEnvs(): void;
}

export const SERVER_TOKEN_PREFIX = 'jlab:srvr:';

export class Registry implements IRegistry, IDisposable {
  constructor() {
    const minJLabVersionRequired = '3.0.0';

    this._requirements = [
      {
        name: 'jupyterlab',
        moduleName: 'jupyterlab',
        commands: ['--version'],
        versionRange: new semver.Range(`>=${minJLabVersionRequired}`)
      }
    ];

    if (!this._condaRootPath && appData.condaRootPath) {
      if (this.validateCondaBaseEnvironmentAtPath(appData.condaRootPath)) {
        this.setCondaRootPath(appData.condaRootPath);

        // set default env from appData.condaRootPath
        if (!this._defaultEnv) {
          const pythonPath =
            process.platform === 'win32'
              ? join(appData.condaRootPath, 'python.exe')
              : join(appData.condaRootPath, 'bin', 'python');
          const defaultEnv = this._resolveEnvironmentSync(pythonPath);
          if (defaultEnv) {
            this._defaultEnv = defaultEnv;
          }
        }
      }
    }

    const allEnvironments = [];
    if (process.platform === 'win32') {
      let windowRegEnvironments = this._loadWindowsRegistryEnvironments(
        this._requirements
      );
      allEnvironments.push(windowRegEnvironments);
    }

    this._registryBuilt = Promise.all<IPythonEnvironment[]>(allEnvironments)
      .then(async environments => {
        let discoveredEnvs = [].concat(...environments);

        this._userSetEnvironments = await this._resolveEnvironments(
          appData.userSetPythonEnvs,
          true
        );

        // filter out user set environments
        discoveredEnvs = discoveredEnvs.filter(env => {
          return !this._userSetEnvironments.find(
            userSetEnv => userSetEnv.path === env.path
          );
        });

        discoveredEnvs = await this._resolveEnvironments(discoveredEnvs, true);
        this._discoveredEnvironments = discoveredEnvs;

        this._updateEnvironments();

        if (!this._defaultEnv && this._environments.length > 0) {
          this._defaultEnv = this._environments[0];
        }
        return;
      })
      .catch(reason => {
        if (reason.fileName || reason.lineNumber) {
          log.error(
            `Registry building failed! ${reason.name} at ${reason.fileName}:${reason.lineNumber}: ${reason.message}`
          );
        } else if (reason.stack) {
          log.error(
            `Registry building failed! ${reason.name}: ${reason.message}`
          );
          log.error(reason.stack);
        } else {
          log.error(
            `Registry building failed! ${reason.name}: ${reason.message}`
          );
        }
      });
  }

  get environmentListUpdated(): ISignal<this, void> {
    return this._environmentListUpdated;
  }

  clearUserSetPythonEnvs(): void {
    if (this._userSetEnvironments.length === 0) {
      return;
    }

    this._userSetEnvironments = [];
    this._updateEnvironments();
    this._environmentListUpdated.emit();
  }

  private async _resolveEnvironments(
    envs: IPythonEnvironment[],
    sort?: boolean
  ): Promise<IPythonEnvironment[]> {
    let filteredEnvs = envs.filter(env => this._pathExistsSync(env.path));
    const uniqueEnvs = this._getUniqueObjects(filteredEnvs, env => {
      return fs.realpathSync(env.path);
    });
    const resolvedEnvs = await Promise.all(
      uniqueEnvs.map(async env => await this._resolveEnvironment(env.path))
    );
    filteredEnvs = resolvedEnvs.filter(env => env !== undefined);

    if (sort) {
      this._sortEnvironments(filteredEnvs, this._requirements);
    }

    return filteredEnvs;
  }

  private async _resolveEnvironment(
    pythonPath: string
  ): Promise<IPythonEnvironment> {
    if (!(await this._pathExists(pythonPath))) {
      return;
    }

    const env = await this.getEnvironmentInfo(pythonPath);

    if (
      env &&
      this._environmentSatisfiesRequirements(env, this._requirements)
    ) {
      return env;
    }
  }

  private _resolveEnvironmentSync(pythonPath: string): IPythonEnvironment {
    if (!this._pathExistsSync(pythonPath)) {
      return;
    }

    const env = this.getEnvironmentInfoSync(pythonPath);

    if (
      env &&
      this._environmentSatisfiesRequirements(env, this._requirements)
    ) {
      return env;
    }
  }

  /**
   * Retrieve the default environment from the registry, once it has been resolved
   *
   * @returns a promise containing the default environment
   */
  getDefaultEnvironment(): Promise<IPythonEnvironment> {
    if (this._defaultEnv) {
      return Promise.resolve(this._defaultEnv);
    } else {
      return new Promise((resolve, reject) => {
        this._registryBuilt
          .then(() => {
            if (this._defaultEnv) {
              resolve(this._defaultEnv);
            } else {
              reject(new Error(`No default environment found!`));
            }
          })
          .catch(reason => {
            reject(
              new Error(`Default environment could not be obtained: ${reason}`)
            );
          });
      });
    }
  }

  getEnvironmentByPath(pythonPath: string): IPythonEnvironment {
    return this._environments.find(env => pythonPath === env.path);
  }

  /**
   * Retrieve the complete list of environments, once they have been resolved
   * @returns a promise that resolves to a complete list of environments
   */
  getEnvironmentList(cacheOK: boolean): Promise<IPythonEnvironment[]> {
    if (cacheOK && this._environments.length > 0) {
      return Promise.resolve(this._environments);
    } else {
      return new Promise((resolve, reject) => {
        this._registryBuilt
          .then(() => {
            if (this._environments) {
              resolve(this._environments);
            } else {
              reject(new Error(`No environment list found!`));
            }
          })
          .catch(reason => {
            reject(
              new Error(`Environment list could not be obtained: ${reason}`)
            );
          });
      });
    }
  }

  get condaRootPath(): Promise<string> {
    return Promise.resolve(this._condaRootPath);
  }

  setCondaRootPath(rootPath: string) {
    this._condaRootPath = rootPath;
    appData.condaRootPath = rootPath;
  }

  /**
   * Create a new environment from a python executable, without waiting for the
   * entire registry to be resolved first.
   * @param pythonPath The location of the python executable to create an environment from
   */
  addEnvironment(pythonPath: string): IPythonEnvironment {
    const inDiscoveredEnvList = this._discoveredEnvironments.find(
      env => pythonPath === env.path
    );
    if (inDiscoveredEnvList) {
      return inDiscoveredEnvList;
    }

    const inUserSetEnvList = this._userSetEnvironments.find(
      env => pythonPath === env.path
    );
    if (inUserSetEnvList) {
      return inUserSetEnvList;
    }

    try {
      const env = this._resolveEnvironmentSync(pythonPath);
      if (env) {
        this._userSetEnvironments.push(env);
        this._updateEnvironments();
        this._environmentListUpdated.emit();
      }

      return env;
    } catch (error) {
      console.error(
        `Failed to add the Python environment at: ${pythonPath}`,
        error
      );
      return;
    }
  }

  validatePythonEnvironmentAtPath(pythonPath: string): boolean {
    return true;
  }

  validateCondaBaseEnvironmentAtPath(envPath: string): boolean {
    // const isWin = process.platform === 'win32';
    // const condaBinPath = path.join(
    //   envPath,
    //   'condabin',
    //   isWin ? 'conda.bat' : 'conda'
    // );
    return true;
  }

  async getEnvironmentInfo(pythonPath: string): Promise<IPythonEnvironment> {
    if (this._disposing) {
      return;
    }

    try {
      const envInfoOut = await this._runCommand(
        pythonPath,
        ['-c', envInfoPyCode],
        {
          env: { PATH: this.getAdditionalPathIncludesForPythonPath(pythonPath) }
        }
      );
      const envInfo = JSON.parse(envInfoOut.trim());
      const envType =
        envInfo.type === 'conda-root'
          ? IEnvironmentType.CondaRoot
          : envInfo.type === 'conda-env'
          ? IEnvironmentType.CondaEnv
          : IEnvironmentType.VirtualEnv;
      const envName = `${EnvironmentTypeName[envType]}: ${envInfo.name}`;

      return {
        path: pythonPath,
        type: envType,
        name: envName,
        versions: envInfo.versions,
        defaultKernel: envInfo.defaultKernel
      };
    } catch (error) {
      console.error(
        `Failed to get environment info at path '${pythonPath}'.`,
        error
      );
    }
  }

  getEnvironmentInfoSync(pythonPath: string): IPythonEnvironment {
    if (this._disposing) {
      return;
    }

    const envInfoOut = this._runCommandSync(pythonPath, ['-c', envInfoPyCode], {
      env: { PATH: this.getAdditionalPathIncludesForPythonPath(pythonPath) }
    });
    const envInfo = JSON.parse(envInfoOut.trim());
    const envType =
      envInfo.type === 'conda-root'
        ? IEnvironmentType.CondaRoot
        : envInfo.type === 'conda-env'
        ? IEnvironmentType.CondaEnv
        : IEnvironmentType.VirtualEnv;
    const envName = `${EnvironmentTypeName[envType]}: ${envInfo.name}`;

    return {
      path: pythonPath,
      type: envType,
      name: envName,
      versions: envInfo.versions,
      defaultKernel: envInfo.defaultKernel
    };
  }

  setDefaultPythonPath(pythonPath: string): void {
    this._defaultEnv = this.getEnvironmentByPath(pythonPath);
  }

  getCurrentPythonEnvironment(): IPythonEnvironment {
    return this._defaultEnv;
  }

  getAdditionalPathIncludesForPythonPath(pythonPath: string): string {
    const platform = process.platform;

    let envPath = path.dirname(pythonPath);
    if (platform !== 'win32') {
      envPath = path.normalize(path.join(envPath, '../'));
    }

    let pathEnv = '';
    if (platform === 'win32') {
      pathEnv = `${envPath};${envPath}\\Library\\mingw-w64\\bin;${envPath}\\Library\\usr\\bin;${envPath}\\Library\\bin;${envPath}\\Scripts;${envPath}\\bin;${process.env['PATH']}`;
    } else {
      pathEnv = `${envPath}:${envPath}/bin:${process.env['PATH']}`;
    }

    return pathEnv;
  }

  getRequirements(): Registry.IRequirement[] {
    return this._requirements;
  }

  getRunningServerList(): Promise<string[]> {
    return new Promise<string[]>(resolve => {
      if (this._defaultEnv) {
        let runningServers: string[] = [];
        resolve(runningServers);
      } else {
        resolve([]);
      }
    });
  }

  getRunningStorageServerList(): Promise<string[]> {
    return new Promise<string[]>(resolve => {
      if (this._defaultEnv) {
        this._runPythonModuleCommand(this._defaultEnv.path, 'jupyter', [
          'server',
          'list',
          '--json'
        ])
          .then(async output => {
            // const runningServers: string[] = [];
            // const lines = output.split('\n');
            // for (const line of lines) {
            //   const jsonStart = line.indexOf('{');
            //   if (jsonStart !== -1) {
            //     const jsonStr = line.substring(jsonStart);
            //     try {
            //       const jsonData = JSON.parse(jsonStr);
            //       // check if server is not created by desktop app and is still running
            //       if (
            //         !jsonData.token.startsWith(SERVER_TOKEN_PREFIX) &&
            //         (await isPortInUse(jsonData.port))
            //       ) {
            //         runningServers.push(
            //           `${jsonData.url}lab?token=${jsonData.token}`
            //         );
            //       }
            //     } catch (error) {
            //       console.error(
            //         `Failed to parse running JupyterLab server list`,
            //         error
            //       );
            //     }
            //   }
            // }

            resolve([]);
          })
          .catch(reason => {
            console.debug(`Failed to get running Sciget server list`, reason);
            resolve([]);
          });
      } else {
        resolve([]);
      }
    });
  }

  private _updateEnvironments() {
    this._environments = [
      ...this._userSetEnvironments,
      ...this._discoveredEnvironments
    ];
    appData.discoveredPythonEnvs = JSON.parse(
      JSON.stringify(this._discoveredEnvironments)
    );
    appData.userSetPythonEnvs = JSON.parse(
      JSON.stringify(this._userSetEnvironments)
    );
  }

  private async _loadWindowsRegistryEnvironments(
    requirements: Registry.IRequirement[]
  ): Promise<IPythonEnvironment[]> {
    const valuePredicate = (value: any) => {
      return value.name === '(Default)';
    };

    const defaultPaths = this._getAllMatchingValuesFromSubRegistry(
      WinRegistry.HKCU,
      '\\SOFTWARE\\Python\\PythonCore',
      'InstallPath',
      valuePredicate
    );

    const installPaths = await defaultPaths;

    return await Promise.all(
      installPaths.map(path => {
        const finalPath = join(path, 'python.exe');

        return {
          name: `WinReg-${basename(normalize(join(path, '..')))}`,
          path: finalPath,
          type: IEnvironmentType.WindowsReg,
          versions: {}
        } as IPythonEnvironment;
      })
    );
  }

  // This function will retrieve all subdirectories of the main registry path, and for each subdirectory(registry) it will search for the key
  // matching the subDirectory parameter and the value the passes
  private async _getAllMatchingValuesFromSubRegistry(
    registryHive: string,
    mainRegPath: string,
    subDirectory: string,
    valueFilter: (value: any) => boolean
  ): Promise<string[]> {
    const mainWinRegistry = new WinRegistry({
      hive: registryHive,
      key: mainRegPath
    });

    const getMainRegistryKeys: Promise<any[]> = new Promise(
      (resolve, reject) => {
        mainWinRegistry.keys((err: any, items: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(items);
          }
        });
      }
    );

    const installPathValues: Promise<any[]> = getMainRegistryKeys
      .then(items => {
        return Promise.all(
          items.map(item => {
            let installPath = new WinRegistry({
              hive: registryHive,
              key: item.key + '\\' + subDirectory
            });

            let allValues: Promise<any[]> = new Promise((resolve, reject) => {
              installPath.values((err: any, values: any[]) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(values);
                }
              });
            });

            return allValues;
          })
        );
      })
      .then(nestedInstallPathValues => {
        return Array.prototype.concat.apply([], nestedInstallPathValues);
      });

    const pathValues = await installPathValues;
    return pathValues.filter(valueFilter).map(v => v.value);
  }

  private _environmentSatisfiesRequirements(
    environment: IPythonEnvironment,
    requirements: Registry.IRequirement[]
  ): boolean {
    return requirements.every((req, index, reqSelf) => {
      try {
        const version = environment.versions[req.name];
        return semver.satisfies(
          versionWithoutSuffix(version),
          req.versionRange
        );
      } catch (e) {
        return false;
      }
    });
  }

  private _pathExists(path: string): Promise<boolean> {
    return new Promise<boolean>((res, rej) => {
      fs.access(path, fs.constants.F_OK, e => {
        res(e === undefined || e === null);
      });
    });
  }

  private _pathExistsSync(path: string): boolean {
    try {
      fs.accessSync(path, fs.constants.F_OK);
      return true;
    } catch (err) {
      return false;
    }
  }

  private _runPythonModuleCommand(
    pythonPath: string,
    moduleName: string,
    commands: string[]
  ): Promise<string> {
    let totalCommands = ['-m', moduleName].concat(commands);
    return new Promise<string>((resolve, reject) => {
      this._runCommand(pythonPath, totalCommands)
        .then(output => {
          let missingModuleReg = new RegExp(`No module named ${moduleName}$`);
          let commandErrorReg = new RegExp(`Error executing Jupyter command`);

          if (missingModuleReg.test(output)) {
            reject(
              new Error(
                `Python executable could not find ${moduleName} module!`
              )
            );
          } else if (commandErrorReg.test(output)) {
            reject(new Error(`Jupyter command execution failed! ${output}`));
          } else {
            resolve(output);
          }
        })
        .catch(reject);
    });
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  private _runPythonModuleCommandSync(
    pythonPath: string,
    moduleName: string,
    commands: string[]
  ): string {
    const totalCommands = ['-m', moduleName].concat(commands);
    const runOptions = {
      env: { PATH: this.getAdditionalPathIncludesForPythonPath(pythonPath) }
    };

    return this._runCommandSync(pythonPath, totalCommands, runOptions);
  }

  private async _runCommand(
    executablePath: string,
    commands: string[],
    options?: ExecFileOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let executableRun = execFile(executablePath, commands, options);
      let stdoutBufferChunks: Buffer[] = [];
      let stdoutLength = 0;
      let stderrBufferChunks: Buffer[] = [];
      let stderrLength = 0;

      executableRun.stdout.on('data', chunk => {
        if (typeof chunk === 'string') {
          let newBuffer = Buffer.from(chunk);
          stdoutLength += newBuffer.length;
          stdoutBufferChunks.push(newBuffer);
        } else {
          stdoutLength += chunk.length;
          stdoutBufferChunks.push(chunk);
        }
      });

      executableRun.stderr.on('data', chunk => {
        if (typeof chunk === 'string') {
          let newBuffer = Buffer.from(chunk);
          stderrLength += newBuffer.length;
          stderrBufferChunks.push(Buffer.from(newBuffer));
        } else {
          stderrLength += chunk.length;
          stderrBufferChunks.push(chunk);
        }
      });

      executableRun.on('close', () => {
        executableRun.removeAllListeners();

        let stdoutOutput = Buffer.concat(
          stdoutBufferChunks,
          stdoutLength
        ).toString();
        let stderrOutput = Buffer.concat(
          stderrBufferChunks,
          stderrLength
        ).toString();

        if (stdoutOutput.length === 0) {
          if (stderrOutput.length === 0) {
            reject(
              new Error(
                `"${executablePath} ${commands.join(
                  ' '
                )}" produced no output to stdout or stderr!`
              )
            );
          } else {
            resolve(stderrOutput);
          }
        } else {
          resolve(stdoutOutput);
        }
      });
    });
  }

  private _runCommandSync(
    executablePath: string,
    commands: string[],
    options?: ExecFileOptions
  ): string {
    try {
      return execFileSync(executablePath, commands, options).toString();
    } catch (error) {
      return 'EXEC:ERROR';
    }
  }

  private _sortEnvironments(
    environments: IPythonEnvironment[],
    requirements: Registry.IRequirement[]
  ) {
    environments.sort((a, b) => {
      let typeCompareResult = this._compareEnvType(a.type, b.type);
      if (typeCompareResult !== 0) {
        return typeCompareResult;
      } else {
        let versionCompareResult = this._compareVersions(
          a.versions,
          b.versions,
          requirements
        );
        if (versionCompareResult !== 0) {
          return versionCompareResult;
        } else {
          return a.name.localeCompare(b.name);
        }
      }
    });
  }

  private _compareVersions(
    a: IVersionContainer,
    b: IVersionContainer,
    requirements: Registry.IRequirement[]
  ): number {
    let versionPairs = requirements.map(req => {
      return [a[req.name], b[req.name]];
    });

    for (let index = 0; index < requirements.length; index++) {
      let [aVersion, bVersion] = versionPairs[index];
      let result = bVersion.localeCompare(aVersion);

      if (result !== 0) {
        return result;
      }
    }

    return 0;
  }

  private _compareEnvType(a: IEnvironmentType, b: IEnvironmentType): number {
    return this._getEnvTypeValue(a) - this._getEnvTypeValue(b);
  }

  private _getEnvTypeValue(a: IEnvironmentType): number {
    switch (a) {
      case IEnvironmentType.Path:
        return 0;
      case IEnvironmentType.CondaRoot:
        return 1;
      case IEnvironmentType.WindowsReg:
        return 2;
      case IEnvironmentType.CondaEnv:
        return 3;
      default:
        return 100;
    }
  }

  // Probably pretty slow, luckily won't ever be used on many values
  private _getUniqueObjects<T, V>(arr: T[], keyFunction?: (value: T) => V) {
    if (keyFunction) {
      let mappedIndices = arr.map(keyFunction).map((keyValue, index, self) => {
        return self.indexOf(keyValue);
      });

      let filteredIndices = mappedIndices.filter(
        (mappedIndex, actualIndex, self) => {
          return mappedIndex === actualIndex;
        }
      );

      let filteredValues = filteredIndices.map(index => {
        return arr[index];
      });

      return filteredValues;
    } else {
      return arr.filter((value, index, self) => {
        return self.indexOf(value) === index;
      });
    }
  }

  dispose(): Promise<void> {
    this._disposing = true;

    return new Promise<void>(resolve => {
      this._registryBuilt.then(() => {
        this._disposing = false;
        resolve();
      });
    });
  }

  private _environments: IPythonEnvironment[] = [];
  private _discoveredEnvironments: IPythonEnvironment[] = [];
  private _userSetEnvironments: IPythonEnvironment[] = [];
  private _defaultEnv: IPythonEnvironment;
  private _condaRootPath: string;
  private _registryBuilt: Promise<void>;
  private _requirements: Registry.IRequirement[];
  private _disposing: boolean = false;
  private _environmentListUpdated = new Signal<this, void>(this);
}

export namespace Registry {
  /**
   * This type represents module/executable package requirements for the python executables
   * in the registry. Each requirement should correspond to a python module that is also
   * executable via the '-m <module_name>' interface
   */
  export interface IRequirement {
    /**
     * The display name for the requirement
     */
    name: string;
    /**
     * The actual module name that will be used with the python executable
     */
    moduleName: string;
    /**
     * List of extra commands that will produce a version number for checking
     */
    commands: string[];
    /**
     * The Range of acceptable version produced by the previous commands field
     */
    versionRange: semver.Range;
  }

  export const COMMON_CONDA_LOCATIONS = [
    join(getUserHomeDir(), 'anaconda3'),
    join(getUserHomeDir(), 'anaconda'),
    join(getUserHomeDir(), 'miniconda3'),
    join(getUserHomeDir(), 'miniconda')
  ];
}
