# Developer Documentation

## Build dependencies

- nodejs

  You can install from https://nodejs.org/en/download/

- yarn

  Install using

  ```bash
  npm install --global yarn
  ```

## Local development

JupyterLab Desktop bundles JupyterLab front-end and a conda environment as JupyterLab Desktop Server as its backend into an Electron application.

`<platform>`: mac, linux or win

- Get the project source code

  ```bash
  git clone https://github.com/jupyterlab/jupyterlab-desktop.git
  ```

- Install dependencies and build JupyterLab Desktop

  ```bash
  yarn
  yarn build
  ```

- Now you can launch the JupyterLab Desktop locally using:

  ```bash
  yarn start
  ```

  If JupyterLab Desktop does not find a compatible Python environment configured, it will prompt for installation using JupyterLab Desktop Server installer or let you choose a custom environment on your computer at first launch.

## Building for distribution

- Build the application

  ```bash
  yarn run clean && yarn build
  ```

- Create JupyterLab Desktop installer which will also bundle JupyterLab Desktop Server installer.

  ```bash
  yarn dist:<platform>
  ```

  Application Installer will be created in `dist/JupyterLab.dmg` (macOS), `dist/JupyterLab.deb` (Debian, Ubuntu), `dist/JupyterLab.rpm` (Red Hat, Fedora) and `dist/JupyterLab-Setup.exe` (Windows) based on the platform

## Release Instructions

For instructions on updating bundled JupyterLab packages and cutting a new release, please follow [Release.md](Release.md) document.
