import { program } from 'commander';
import { parseComposeFile } from './compose-spec';
import { handleUpCommand } from './lifecycle';
import { handleDownCommand } from './down';
import { handleStatusCommand } from './status';
import { handleExecCommand } from './exec';

program
  .command('up')
  .description('Run compose services as sandboxes (MVP 1.0)')
  .option('-f, --file <path>', 'Compose file path', 'docker-compose.yml')
  .option('--profile <profiles>', 'Enable specific profiles (comma-separated)')
  .action(async (options) => {
    try {
      const composeData = parseComposeFile(options.file);
      await handleUpCommand(composeData, options);
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.error(`Error: ${errorMessage}`);
      process.exit(1);
    }
  });

program
  .command('down')
  .description('Stop and remove compose services')
  .option('-f, --file <path>', 'Compose file path', 'docker-compose.yml')
  .option('--profile <profiles>', 'Enable specific profiles (comma-separated)')
  .action(async (options) => {
    try {
      const composeData = parseComposeFile(options.file);
      await handleDownCommand(composeData, options);
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.error(`Error: ${errorMessage}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show status of all sandboxes')
  .action(() => {
    handleStatusCommand();
  });

program
  .command('exec <service> [command...]')
  .description('Execute command in service sandbox')
  // Commander passes the variadic [command...] as a single array argument, with
  // the trailing `--` separator already stripped as the option terminator.
  .action((service: string, command: string[]) => {
    handleExecCommand(service, ...(command ?? []));
  });

program.parse(process.argv);