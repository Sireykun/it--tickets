const vscode = require('vscode');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { join } = require('node:path');
const { existsSync } = require('node:fs');

const exec = promisify(execFile);
let pushButton, pullButton;

function folder() {
  const folders = vscode.workspace.workspaceFolders || [];
  const active = vscode.window.activeTextEditor?.document.uri;
  const selected = active ? vscode.workspace.getWorkspaceFolder(active) : null;
  return selected?.uri.fsPath || folders[0]?.uri.fsPath;
}

async function git(cwd, ...args) {
  try {
    const result = await exec('git', args, { cwd, windowsHide: true, maxBuffer: 1024 * 1024 });
    return result.stdout.trim();
  } catch (error) {
    const detail = (error.stderr || error.stdout || error.message || '').trim();
    throw new Error(detail || 'Git command failed');
  }
}

async function hasRemote(cwd) {
  return (await git(cwd, 'remote')).split(/\r?\n/).includes('origin');
}

async function refresh() {
  const cwd = folder();
  if (!cwd || !existsSync(join(cwd, '.git'))) {
    pushButton.hide(); pullButton.hide(); return;
  }
  const connected = await hasRemote(cwd).catch(() => false);
  pullButton.text = connected ? '$(cloud-download) Pull' : '$(plug) Connect GitHub';
  pullButton.tooltip = connected ? 'Pull the latest commits from GitHub' : 'Connect this folder to a GitHub repository';
  pullButton.command = connected ? 'itdeskGit.pull' : 'itdeskGit.connect';
  pushButton.text = '$(cloud-upload) Push';
  pushButton.tooltip = 'Push committed changes to GitHub';
  pushButton.command = connected ? 'itdeskGit.push' : 'itdeskGit.connect';
  pullButton.show(); pushButton.show();
}

async function connect() {
  const cwd = folder();
  if (!cwd) return;
  if (await hasRemote(cwd)) return refresh();
  const url = await vscode.window.showInputBox({
    title: 'Connect GitHub repository',
    prompt: 'Paste the HTTPS or SSH URL of your GitHub repository',
    placeHolder: 'https://github.com/your-name/it-tickets.git',
    ignoreFocusOut: true,
    validateInput(value) {
      return /^(https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?|git@github\.com:[^/\s]+\/[^/\s]+(?:\.git)?)$/.test(value)
        ? null : 'Enter a GitHub repository URL.';
    }
  });
  if (!url) return;
  try {
    await git(cwd, 'remote', 'add', 'origin', url);
    vscode.window.showInformationMessage('GitHub repository connected. Commit your changes, then click Push.');
    await refresh();
  } catch (error) { vscode.window.showErrorMessage(`Could not connect GitHub: ${error.message}`); }
}

async function run(action) {
  const cwd = folder();
  if (!cwd) return;
  try {
    if (!(await hasRemote(cwd))) return connect();
    if (await git(cwd, 'status', '--porcelain')) {
      if (action === 'pull') {
        const choice = await vscode.window.showWarningMessage(
          'Commit or stash your local changes before pulling.', 'Open Source Control');
        if (choice) vscode.commands.executeCommand('workbench.view.scm');
        return;
      }
      const choice = await vscode.window.showInformationMessage(
        'You have uncommitted changes. Review them or commit all files and push?',
        'Commit & Push', 'Open Source Control');
      if (choice === 'Open Source Control') vscode.commands.executeCommand('workbench.view.scm');
      if (choice !== 'Commit & Push') return;
      const message = await vscode.window.showInputBox({
        title: 'Commit message', value: 'Update IT Desk',
        prompt: 'All changed files except ignored files will be committed.',
        validateInput: value => value.trim() ? null : 'Enter a commit message.'
      });
      if (!message) return;
      await git(cwd, 'add', '-A');
      await git(cwd, 'commit', '-m', message.trim());
    }
    const branch = await git(cwd, 'branch', '--show-current');
    if (!branch) throw new Error('Check out a branch before syncing.');
    if (action === 'pull') {
      if (!(await git(cwd, 'ls-remote', '--heads', 'origin', branch))) {
        vscode.window.showInformationMessage(`No ${branch} branch is on GitHub yet. Click Push to create it.`);
        return;
      }
      await git(cwd, 'pull', '--ff-only', 'origin', branch);
      vscode.window.showInformationMessage(`Pulled the latest ${branch} changes.`);
    } else {
      let upstream = false;
      try { upstream = !!(await git(cwd, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}')); } catch {}
      await git(cwd, ...(upstream ? ['push'] : ['push', '-u', 'origin', branch]));
      vscode.window.showInformationMessage(`Pushed ${branch} to GitHub.`);
    }
  } catch (error) { vscode.window.showErrorMessage(`${action === 'pull' ? 'Pull' : 'Push'} failed: ${error.message}`); }
}

function activate(context) {
  pullButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 101);
  pushButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(pullButton, pushButton,
    vscode.commands.registerCommand('itdeskGit.pull', () => run('pull')),
    vscode.commands.registerCommand('itdeskGit.push', () => run('push')),
    vscode.commands.registerCommand('itdeskGit.connect', connect),
    vscode.window.onDidChangeActiveTextEditor(refresh),
    vscode.workspace.onDidChangeWorkspaceFolders(refresh));
  refresh();
}

function deactivate() {}
module.exports = { activate, deactivate };
