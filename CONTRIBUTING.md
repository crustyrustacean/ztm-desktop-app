# Contributing

## Setup

Before you get started you should make sure your environment is set up and that you can run the app on your computer. If you need help with setting up you can reach out in the Discord.

## Prerequisites

This project uses TypeScript, Node, React, Tauri, and Rust.

### Node and npm

You should be on a current LTS version of Node. This is Node 22+ at the time these docs were written.

If you don't already have Node installed, the best way to install it is through a version manager.
- [nvm](https://www.nvmnode.com/guide/installation.html) is a popular node version manager that has good cross-platform support
- [fnm](https://www.fnmnode.com/guide/install.html) is another option for people who prefer their things written in Rust

After you've installed a version manager you can use it to install Node.

npm comes with Node, so installing node will also cover npm

### Rust and Cargo

If you don't have Rust intalled you can install it and cargo using [rustup](https://rustup.rs/)

### Tauri prequisites

Depending on your operating system you may have to install some system utilities to run Tauri. [See the Tauri prerequesites doc](https://v2.tauri.app/start/prerequisites/).

### Confirm your setup

After installing you can check to make sure things are all installed. Each of these commands should give you some kind of a version number.

```sh
node --version
npm --version
rustc --version
cargo --version
```

## Running the App

*All of these commands should be run from the repository root.*

### Install dependencies

Use npm to install the project's dependencies.

```sh
npm ci
```

> [!NOTE]
> `npm ci` installed the versions in the `package-lock.json`. You can also use `npm install` but it's generally safer to use `ci` when you can.

### Run the app

**Starts vite and the desktop app**

```sh
npm run tauri dev
```

**Starts just the browser preview**

```sh
npm run dev
```

### Troubleshooting

You can run this to figure out what dependencies Tauri is missing (hopefully this is none if you did the setup above).

```sh
npm run tauri info
```

If you get stuck you can reach out in the Discord.
