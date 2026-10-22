import { exec } from 'child_process';

interface StatusRow {
  name?: string;
  id?: string;
  status?: string;
  image?: string;
  ports?: string[];
}

export function handleStatusCommand(): void {
  exec('msb list --json', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error fetching status: ${stderr}`);
      process.exit(1);
    }

    let services: StatusRow[];
    try {
      services = JSON.parse(stdout) as StatusRow[];
    } catch (err) {
      console.error('Failed to parse status: ', err);
      process.exit(1);
    }

    if (!Array.isArray(services) || services.length === 0) {
      console.log('No running sandboxes');
      return;
    }

    console.log('Service\tSandbox ID\tStatus\tImage\tPorts');
    services.forEach((service) => {
      const portStr = service.ports ? service.ports.join(', ') : '';
      console.log(`${service.name}\t${service.id}\t${service.status}\t${service.image}\t${portStr}`);
    });
  });
}
