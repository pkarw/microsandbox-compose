import { program } from 'commander';
import { parseComposeFile } from './compose-spec';
import { handleUpCommand } from './lifecycle';

program
  .command('up')
  .description('Run compose services as sandboxes')
  .option('-f, --file <path>', 'Compose file path', 'docker-compose.yml')
  .option('--profile <profile>', 'Enable specific profiles')
  .action((options) => {
    try {
      const composeData = parseComposeFile(options.file);
      handleUpCommand(composeData, options.profile);
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.error(`Error: ${errorMessage}`);
      process.exit(1);
    }
  });

program.parse(process.argv);