#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const figlet = require('figlet');
const versionStr = figlet.textSync('Types CLI');
const Printer = require('@darkobits/lolcatjs');
const version = require('../package.json').version;
const ora = require('ora');
const inquirer = require('inquirer');
const chalk = require('chalk');
const shell = require('shelljs');
const transformed = Printer.fromString(
  ` \n   ✨ Types CLI v${version} ✨ \n ${versionStr}`
);
const {
  quicktype,
  InputData,
  jsonInputForTargetLanguage,
} = require('quicktype-core');

// Default paths
const desktopPath = path.join(require('os').homedir(), 'Desktop');
const currentPath = process.cwd();

// Check if VSCode is installed
const hasVSCode = shell.which('code');

/**
 * Generate type definitions
 */
async function generateTypes(url, typeName) {
  const spinner = ora('🚀 Fetching API data...').start();

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const jsonData = await response.json();
    spinner.text = '🔄 Parsing data structure...';

    const sampleData = Array.isArray(jsonData) ? jsonData[0] : jsonData;

    spinner.text = '📝 Generating type definitions...';
    const jsonInput = await jsonInputForTargetLanguage('typescript');
    await jsonInput.addSource({
      name: typeName,
      samples: [JSON.stringify(sampleData)],
    });

    const inputData = new InputData();
    inputData.addInput(jsonInput);

    spinner.text = '🎨 Optimizing type structure...';
    const { lines } = await quicktype({
      lang: 'typescript',
      inputData,
      alphabetizeProperties: true,
      rendererOptions: {
        'just-types': 'true',
        'explicit-unions': 'true',
      },
    });

    spinner.succeed(chalk.green('✨ Awesome! Type definitions generated successfully!'));

    if (!lines || lines.length === 0) {
      throw new Error('⚠️ Generated types are empty, please check API response data');
    }

    return { lines };
  } catch (error) {
    spinner.fail(chalk.red('❌ Processing failed'));
    throw error;
  }
}

async function promptUser() {
  console.log(chalk.cyan('\n👋 Welcome to the type generation tool! Let\'s get started~\n'));

  const questions = [
    {
      type: 'input',
      name: 'url',
      message: '🌐 Please enter API URL:',
      validate: (input) => {
        try {
          new URL(input);
          return true;
        } catch {
          return '❌ Invalid URL format, please enter a valid URL';
        }
      },
    },
    {
      type: 'input',
      name: 'name',
      message: '📝 Please enter type name:',
      default: 'ApiTypes',
      validate: (input) => {
        if (/^[A-Za-z][A-Za-z0-9]*$/.test(input)) {
          return true;
        }
        return '❌ Type name must start with a letter and contain only letters and numbers';
      },
    },
    {
      type: 'list',
      name: 'path',
      message: '📂 Please select save location:',
      choices: [
        { name: '💻 Desktop', value: desktopPath },
        { name: '📁 Current directory', value: currentPath },
        { name: '🔍 Custom path', value: 'custom' },
      ],
    },
  ];

  const answers = await inquirer.prompt(questions);

  if (answers.path === 'custom') {
    const { customPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customPath',
        message: '📁 Please enter save path:',
        default: currentPath,
        validate: (input) => {
          if (shell.test('-d', input)) {
            return true;
          }
          return '❌ Path does not exist, please enter a valid path';
        },
      },
    ]);
    answers.path = customPath;
  }

  return answers;
}

program
  .version(transformed)
  .description('🚀 Generate TypeScript type definitions from API URL')
  .option('-u, --url <url>', 'API URL address')
  .option('-n, --name <name>', 'Generated type name')
  .option('-p, --path <path>', 'Save path')
  .action(async (options) => {
    try {
      const config = options.url ? options : await promptUser();

      const { lines } = await generateTypes(config.url, config.name);

      const spinner = ora('💾 Saving file...').start();

      // Use shelljs to create directory
      if (!shell.test('-d', config.path)) {
        shell.mkdir('-p', config.path);
      }

      const fullPath = path.join(config.path, `${config.name}.ts`);
      // Use shelljs to write file
      shell.ShellString(lines.join('\n')).to(fullPath);

      spinner.succeed(chalk.green('🎉 File saved successfully!'));

      console.log(chalk.cyan('\n📍 File saved at:'), fullPath);
      console.log(chalk.yellow('\n👀 Type definitions preview:\n'));
      console.log(chalk.gray('✨ ----------------------------------------'));
      console.log(lines.join('\n'));
      console.log(chalk.gray('✨ ----------------------------------------\n'));

      // If VSCode is installed, provide open option
      if (hasVSCode) {
        const { openFile } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'openFile',
            message: '🔍 Would you like to open the generated file in VSCode?',
            default: false,
          },
        ]);

        if (openFile) {
          // Use shelljs to execute command
          const result = shell.exec(`code "${fullPath}"`, { silent: true });
          if (result.code === 0) {
            console.log(chalk.green('\n📝 File opened in VSCode'));
          } else {
            console.log(chalk.yellow('\n⚠️  Cannot automatically open file, please open manually'));
          }
        }
      }

      console.log(chalk.green('\n👋 Thanks for using, happy coding!\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);