#!/usr/bin/env node

/**
 * Simple type generation tool
 * Usage: types-gen -u <api-url> -n <type-name> -p <save-path>
 */

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const figlet = require('figlet');
const versionStr = figlet.textSync('Types CLI');
const Printer = require('@darkobits/lolcatjs');
const version = require('../package.json').version;
const ora = require('ora');
const transformed = Printer.default.fromString(
  ` \n   Types CLI v${version} ✨ \n ${versionStr}`
);
const {
  quicktype,
  InputData,
  jsonInputForTargetLanguage,
} = require('quicktype-core');

// Get desktop path as default save location
const desktopPath = path.join(require('os').homedir(), 'Desktop');

/**
 * Generate type definitions
 * @param {string} url - API URL
 * @param {string} typeName - Type name
 */
async function generateTypes(url, typeName) {
  const spinner = ora('Fetching API data...').start();

  try {
    // Fetch API data
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const jsonData = await response.json();
    spinner.text = 'Generating type definitions...';

    // Handle array and object data
    const sampleData = Array.isArray(jsonData) ? jsonData[0] : jsonData;

    // Create TypeScript input
    const jsonInput = await jsonInputForTargetLanguage('typescript');
    await jsonInput.addSource({
      name: typeName,
      samples: [JSON.stringify(sampleData)],
    });

    const inputData = new InputData();
    inputData.addInput(jsonInput);

    // Generate types
    const { lines } = await quicktype({
      lang: 'typescript',
      inputData,
      alphabetizeProperties: true,
      rendererOptions: {
        'just-types': 'true',
        'explicit-unions': 'true',
      },
    });

    spinner.succeed('Type definitions generated successfully!');

    if (!lines || lines.length === 0) {
      throw new Error('Generated types are empty, please check API response data');
    }

    return { lines };
  } catch (error) {
    spinner.fail('Processing failed');
    throw error;
  }
}

// Configure CLI commands
program.version(transformed);

program
  .description('Generate TypeScript type definitions from API URL')
  .option('-u, --url <url>', 'API URL address')
  .option('-n, --name <name>', 'Generated type name', 'ApiTypes')
  .option('-p, --path <path>', 'Save path', desktopPath)
  .action(async (options) => {
    if (!options.url) {
      console.error('Please provide API URL address');
      process.exit(1);
    }

    try {
      // Generate type definitions
      const { lines } = await generateTypes(options.url, options.name);

      // Save file
      const fullPath = path.join(options.path, `${options.name}.ts`);
      fs.writeFileSync(fullPath, lines.join('\n'));

      // Print results
      console.log(`\nType file saved to: ${fullPath}`);
      console.log('\nGenerated type definitions preview:');
      console.log('----------------------------------------');
      console.log(lines.join('\n'));
      console.log('----------------------------------------');
    } catch (error) {
      console.error('\nType generation failed:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);