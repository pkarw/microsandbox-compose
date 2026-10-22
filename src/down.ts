import { ComposeProject } from './types';
import { runMsb } from './msb';

export async function handleDownCommand(composeData: ComposeProject, options: { file: string, profile?: string }) {
  const projectName = composeData.name || 'default-project';
  const activeProfiles = options.profile ? options.profile.split(',') : [];

  // Stop and remove every currently-enabled service (order-independent teardown).
  const services = Object.entries(composeData.services).filter(([_, service]) => {
    if (service.profiles) return service.profiles.some(profile => activeProfiles.includes(profile));
    return true;
  });

  if (services.length === 0) {
    console.log('No enabled services to stop');
  }

  for (const [serviceName] of services) {
    console.log(`Stopping service: ${serviceName}`);
    try {
      await runMsb(`msb destroy --service ${serviceName}`);
      console.log(`${serviceName} stopped successfully`);
    } catch (error: unknown) {
      // Idempotent teardown (US-1.3): an already-removed service is not an error.
      const message = error instanceof Error ? error.message : String(error);
      if (/not (found|exist|running)/i.test(message)) {
        console.log(`${serviceName} already stopped`);
      } else {
        console.error(`Error stopping ${serviceName}: ${message}`);
      }
    }
  }

  // Then delete the project network.
  console.log(`Deleting network: ${projectName}`);
  try {
    await runMsb(`msb network delete ${projectName}`);
    console.log('Network deleted successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not (found|exist)/i.test(message)) {
      console.log('Network already removed');
    } else {
      console.error(`Network deletion failed: ${message}`);
    }
  }
}
