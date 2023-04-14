# Configuring Neurodesk Server launch

## Server Launch Arguments

Neurodesk Desktop sets several launch arguments when launching the Neurodesk Server instances. Some arguments are fixed and cannot be changed and some default arguments are added to the fixed arguments. Server tab in the settings dialog allows you to add custom arguments and override the default arguments. You can see the preview of the server launch command as you make changes.

<img src="media/server-launch-args.png" alt="Server launch args" width=800 />

## Server Environment Variables

When Neurodesk Server is launched, environment variables are passed from desktop application to the server process. These environment variables depend on how you launched the desktop app (from CLI or via OS GUI). Also note that your Python environment is activated during Neurodesk Server launch and that activation adds additonal environment variables and modifies the PATH environment variable for the server process.

You can set additional environment variables for the Neurodesk server process by using the Server tab of the settings dialog, as shown below.

If the environment variable you set already exists, it will be replaced by your setting. `PATH` environment variable is handled specially and you can modify it instead of replacing. You can use existing PATH environment variable in your setting by referring to it as `{PATH}`. This way you can append or prepend to the existing PATH environment variable.

<img src="media/server-env-vars.png" alt="Server environment vars" width=800 />

# Connecting to an existing Neurodesk Server

Neurodesk Desktop creates new Neurodesk sessions by launching a locally running Neurodesk server and connecting to it. It can also connect to an existing Neurodesk server instance that is running locally or remotely. In order to connect to a server, click the `Connect...` button in the Start section of the Welcome Page.

<img src="media/start-session-connect.png" alt="Connect to server" width=250 />

This will launch a dialog that automatically discovers and lists the locally running Neurodesk server instances and previously connected local or remote servers in the app history.

<img src="media/connect-to-server.png" alt="Connect to server list" width=700 />

Select a server from the list or enter the URL of the Neurodesk application server including `/lab` in the URL. If the server requires a token for authentication, make sure to include it as a query parameter of the URL as well (`/lab?token=<token-value>`). After entering a URL hit `Enter` key to connect.

Neurodesk Desktop can connect to remote server instances that require additional authentication such as Single Sign-On (SSO). If the `Persist session data` option is checked, then the session information is stored and Neurodesk Desktop will re-use this data on the next launch. If this option is not checked, the session data is automatically deleted at the next launch and servers requiring authentication will prompt for re-login.

You can delete the stored session data manually at any time by using the `Clear History` option in the Privacy tab of Settings dialog.

<img src="media/settings-privacy.png" alt="Clear History" width=800 />

## How to create a Custom Python Environment

### Using conda

```bash
conda create -n custom_venv
conda activate custom_venv
conda install -c conda-forge neurodesk==3.6.1
# install custom packages
conda install -c conda-forge scikit-learn
```

### Using venv

```bash
python3 -m venv custom_venv
source custom_venv/bin/activate
pip install --upgrade pip
pip install neurodesk==3.6.1
# install custom packages
pip install scikit-learn
```

# Customizing the Bundled Python Environment

Neurodesk Desktop is a self-contained standalone desktop application which bundles a Python environment. The bundled Python environment comes with several popular Python libraries to make the application ready to use in scientific computing and data science workflows. These packages are `numpy`, `scipy`, `pandas`, `ipywidgets` and `matplotlib`. In order to install additional packages into Neurodesk Desktop's Python environment, you need to follow certain steps during and after the installation as described below.

## Linux Instructions

On Linux, Neurodesk Desktop is installed into `/opt/Neurodesktop` and Python environment is created in `~/.config/neurodesk-desktop/jlab_server`

## macOS Instructions

On macOS, Neurodesk Desktop is installed into `/Applications/Neurodesk` and Python environment is created in `~/Library/neurodesk-desktop/jlab_server`.

## Windows Instructions

On Windows, there are two installers, one of them is run during initial setup for the main Neurodesk Desktop applicationa and the other one is run when a Python environment needs to be installed. Both of them should be installed to their default install locations. It is `C:\Neurodesk\` for Neurodesk Desktop and `C:\Users\<username>\AppData\Roaming\neurodesk-desktop\jlab_server` for Neurodesk Desktop Server.

# Installing New Python Packages

Make sure you installed Neurodesk Desktop following the steps outlined above in order to have required permissions to install new Python packages.

- Open a Notebook and run the command below in a cell for the package you want to install. You will see the log of the installation process as the cell output.
  ```bash
  %pip install <package_name>
  ```
  For example: to install scikit-learn
  ```bash
  %pip install scikit-learn
  ```
- In order to use the newly installed package you need to restart your active notebook's kernel or create a new notebook
- If you install a new Neurodesk extension with UI components, then you will need to create a new session for changes to take effect

# Configuration and data files

Neurodesk Desktop stores application data in different locations as JSON files. Below are the storage locations and type of data they contain.

- User settings: `{jlab-desktop-user-data-dir}/settings.json`

  This file contains application settings such as default Python path and theme. These settings can be configured from Settings dialog in the application UI.

- Project settings: `{working-directory}/.jupyter/desktop-settings.json`

  This file contains project (working directory) specific overrides of user settings. Currently only `pythonPath` (which is the Python executable path for the Python environment to use for the working directory) setting can be overridden.

- Application data: `{jlab-desktop-user-data-dir}/app-data.json`

  This file contains data used by the application, e.g. recent sessions list, news feed cache, Python environment list cache.

`{jlab-desktop-user-data-dir}` is OS specific and as below

- `%APPDATA%\neurodesk-desktop` on Windows
- `$XDG_CONFIG_HOME/neurodesk-desktop` or `~/.config/neurodesk-desktop` on Linux
- `~/Library/Application Support/neurodesk-desktop` on macOS

Neurodesk Desktop also uses custom configuration paths for better user experience and to prevent clashes with existing Jupyter installations.

Jupyter config files directory (`JUPYTER_CONFIG_DIR`) is set to `{jlab-desktop-user-data-dir}`. jupyter-server settings, neurodesk settings, and any other Jupyter configuration are saved to and loaded from this directory. You can change the configuration path by specifying `JLAB_DESKTOP_CONFIG_DIR` environment variable.

Neurodesk workspace data is stored into the working directory, for each folder a new session is started in. This allows restoring open files and UI layout of sessions for different working directories. `{working-directory}/.jupyter/desktop-workspaces` directory is automatically created and used to save and load workspace data for each working directory. You can change this behavior by specifying `JLAB_DESKTOP_WORKSPACES_DIR` environment variable.

## Project settings that can be overridden

Neurodesk Desktop allows a subset of user settings to be overridden by project settings. Below is the list of settings that can be overridden by each project (working directory) with example values.

Example `/.jupyter/desktop-settings.json`

```JSON
{
  "pythonPath" : "/opt/miniconda/env/bin/python",
  "serverArgs": "--GatewayClient.url=\"https://example.org:8888\"",
  "overrideDefaultServerArgs": true,
  "serverEnvVars": {
    "PYTHONPATH": "/opt/dev/pythonmodule",
    "SERVICE_API": "https://service.example.org:9999/api"
  }
}
```

## Copying configuration from previous installation

You can transfer settings from previous Neurodesk installations into Neurodesk Desktop by copying them over to the new configuration path `{jlab-desktop-user-data-dir}` by following these steps:

1. Run `jupyter --paths` to determine where your `config` is stored.
2. Find directory called `lab` in one of these paths.
3. If there is a `user-settings` directory in `lab`, you can copy the `lab` directory over to the configuration path `{jlab-desktop-user-data-dir}` of Neurodesk Desktop to keep your old Neurodesk settings.

**Warning**: If you copy over settings from an older major version of Neurodesk (e.g. 2.x) those might cause an error on startup. Similarly, if you copy settings from a newer (major or minor) version you may see errors.

# Theming

Neurodesk Desktop supports light and dark themes for the application interface. In the settings dialog you can choose `Light`, `Dark` or `System` options to set the desired theme as shown below. `System` option detects the theme used by your OS and sets that as the app theme.

The themes for the Neurodesk UIs shown in the session windows are controlled separately. If you choose `Sync Neurodesk theme` option in the settings dialog then the app theme chosen is applied to the Neurodesk UIs as well but they correspond to `Neurodesk Light` and `Neurodesk Dark` themes. If you would like to use a theme other than `Neurodesk Light` or `Neurodesk Dark` then you need to uncheck the `Sync Neurodesk theme` option.

<img src="media/themes.png" alt="Themes" width=700 />

# Uninstalling Neurodesk Desktop

## Debian, Ubuntu Linux

```bash
sudo apt-get purge neurodesk-desktop # remove application
rm /usr/bin/neurodesktop # remove command symlink

# to remove application cache
rm -rf ~/.config/neurodesk-desktop
```

## Red Hat, Fedora, SUSE Linux

```bash
sudo rpm -e neurodesktop-desktop # remove application
rm /usr/bin/neurodesktop # remove command symlink

# to remove application cache
rm -rf ~/.config/neurodesktop-desktop
```

## macOS

Find the application installation `Neurodesktop.app` in Finder (in /Applications or ~/Applications) and move to Trash by using `CMD + Delete`. Clean other application generated files using:

# to remove application cache and bundled Python environment

rm -rf ~/Library/neurodesktop-desktop

# to remove user data

rm -rf ~/Library/Application\ Support/neurodesktop-desktop

```

## Windows

On Windows, Neurodesk Desktop is installed in two parts, one for the python environment and another for the application itself. Go to `Windows Apps & Features` dialog using `Start Menu` -> `Settings` -> `Apps` and uninstall Neurodesk Desktop application as shown below.

<img src="media/uninstall-windows-application.png" alt="Uninstall the application" height=200 />

In order to remove application cache, delete `C:\Users\<username>\AppData\Roaming\neurodesktop-desktop` directory.
```
