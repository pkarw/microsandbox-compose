import { exec } from 'child_process';

export function handleExecCommand(service: string, ...args: string[]) {
  // Drop the compose-style `--` separator if present, but only the leading one:
  // a user's own flags (e.g. `grep --foo`) must survive.
  let cleanArgs = args;
  if (cleanArgs[0] === '--') {
    cleanArgs = cleanArgs.slice(1);
  }

  if (cleanArgs.length === 0) {
    console.error('Error: Command not specified. Usage: microsandbox-compose exec <service> -- <cmd> [args...]');
    process.exit(1);
  }

  const cmd = cleanArgs.join(' ');
  const fullCommand = `msb exec --service ${service} -- ${cmd}`;
  
  console.log(`Running: ${fullCommand}`);
  exec(fullCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Command failed: ${stderr}`);
      process.exit(1);
    }
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  });
}