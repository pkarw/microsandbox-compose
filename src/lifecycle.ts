import { ComposeProject, ComposeService } from './types';
import { createProjectNetwork, runMsb } from './msb';

type PortMapping = {
  bindAddress?: string;
  hostPort?: string;
  containerPort: string;
};

function validateVolumes(volumes: string[] | undefined, serviceName: string) {
  if (!volumes) return;
  for (const vol of volumes) {
    if (!vol.includes(':')) {
      throw new Error(`Volume '${vol}' for service ${serviceName} must have host and container path separated by colon`);
    }
    const [source] = vol.split(':');
    if (!source.startsWith('/') && !source.startsWith('./') && !source.startsWith('../')) {
      throw new Error(`Volume '${vol}' for service ${serviceName} appears to be a named volume which is unsupported in MVP`);
    }
  }
}

function interpolateEnv(env: Record<string, string>) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    let interpolated = value;
    const pattern = /\${(.+?)(?::-(.*?))?}/g;
    interpolated = interpolated.replace(pattern, (match, varName, defaultValue) => {
      const hostValue = process.env[varName];
      if (hostValue !== undefined) {
        return hostValue;
      }
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      return '';
    });
    result[key] = interpolated;
  }
  return result;
}

function parsePort(portStr: string): PortMapping {
  const parts = portStr.split(':');
  if (parts.length === 1) {
    return { containerPort: parts[0] };
  } else if (parts.length === 2) {
    return {
      hostPort: parts[0],
      containerPort: parts[1]
    };
  } else if (parts.length === 3) {
    return {
      bindAddress: parts[0],
      hostPort: parts[1],
      containerPort: parts[2]
    };
  } else {
    throw new Error(`Invalid port syntax: ${portStr}`);
  }
}

function topologicalSort(services: Record<string, ComposeService>): string[] {
  const in_degree: Record<string, number> = {};
  const graph: Record<string, string[]> = {};

  // Initialize for all services
  for (const name of Object.keys(services)) {
    in_degree[name] = 0;
    graph[name] = [];
  }

  // Build graph edges. A `depends_on` that points at a service not in the
  // active set (e.g. gated off by `--profile`) just yields no edge: compose
  // treats depends_on as an ordering hint, never a start prerequisite.
  for (const [name, service] of Object.entries(services)) {
    if (service.depends_on) {
      for (const dep of service.depends_on) {
        if (dep in services) {
          graph[dep].push(name);
          in_degree[name]++;
        }
      }
    }
  }

  // Find nodes with zero in-degree
  const queue = Object.keys(services).filter(name => in_degree[name] === 0);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    sorted.push(current);

    for (const neighbor of graph[current]) {
      in_degree[neighbor]--;
      if (in_degree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for cycles
  if (sorted.length !== Object.keys(services).length) {
    throw new Error('Circular dependency detected in services');
  }

  return sorted;
}

export async function handleUpCommand(composeData: ComposeProject, options: { file: string, profile?: string }) {
  const projectName = composeData.name || 'default-project';
  const activeProfiles = options.profile ? options.profile.split(',') : [];

  // Filter active services based on profiles
  const activeServices: Record<string, ComposeService> = {};
  for (const [service, config] of Object.entries(composeData.services)) {
    if (config.profiles && !config.profiles.some(profile => activeProfiles.includes(profile))) {
      continue;
    }
    activeServices[service] = config;
  }

  // Validate services
  for (const [service, config] of Object.entries(activeServices)) {
    // Check for env_file (unsupported in MVP)
    if (config.env_file) {
      throw new Error(`env_file is unsupported for service ${service}`);
    }

    // Check for restart policy (unsupported in MVP)
    if (config.restart) {
      throw new Error(`Restart policy is unsupported for service ${service}`);
    }

    // Validate volumes
    validateVolumes(config.volumes, service);
  }

  // Check for port conflicts
  let portMap: Record<string, string> = {};
  for (const [service, config] of Object.entries(activeServices)) {
    if (config.ports) {
      for (const port of config.ports) {
        const mapping = parsePort(port);
        if (mapping.hostPort) {
          if (portMap[mapping.hostPort]) {
            throw new Error(`Port conflict: ${mapping.hostPort} used by ${portMap[mapping.hostPort]} and ${service}`);
          }
          portMap[mapping.hostPort] = service;
        }
      }
    }
  }

  // Perform topological sort to determine startup order
  let serviceOrder = Object.keys(activeServices);
  if (Object.values(activeServices).some(service => service.depends_on)) {
    serviceOrder = topologicalSort(activeServices);
  }

  // Create internal network for project (shared across all sandboxes)
  createProjectNetwork(projectName);

  // Start services in dependency order
  for (const serviceName of serviceOrder) {
    const service = activeServices[serviceName];
    
    // Build msb command
    let command = `msb create --service ${serviceName}`;
    command += ` --image ${service.image}`;
    command += ` --network ${projectName}`;

    // Add command if exists
    if (service.command) {
      command += ` --command '${service.command.join(' ')}'`;
    }

    // Add volumes
    if (service.volumes) {
      for (const vol of service.volumes) {
        command += ` --volume '${vol}'`;
      }
    }

    // Add ports
    if (service.ports) {
      for (const port of service.ports) {
        command += ` --port '${port}'`;
      }
    }

    // Add environment variables
    if (service.env) {
      const env = interpolateEnv(service.env);
      for (const [key, value] of Object.entries(env)) {
        command += ` --env '${key}=${value}'`;
      }
    }

    // Add resources
    if (service.cpus) {
      command += ` --cpu ${service.cpus}`;
    }
    if (service.memory) {
      command += ` --memory ${service.memory}`;
    }

    console.log(`Starting service: ${serviceName}`);
    console.log(`Command: ${command}`);

    try {
      await runMsb(command);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error starting ${serviceName}: ${message}`);
      process.exit(1);
    }
    console.log(`${serviceName} started successfully`);
  }
}