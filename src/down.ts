import { exec } from 'child_process';
import { ComposeProject } from './types';

export function handleDownCommand(composeData: ComposeProject, options: { file: string, profile?: string }) {
  const projectName = composeData.name || 'default-project';
  const activeProfiles = options.profile ? options.profile.split(',') : [];

  // First, stop and remove all active services
  const services = Object.entries(composeData.services).filter(([_, service]) => {
    if (service.profiles) return service.profiles.some(profile => activeProfiles.includes(profile));
    return true;
  })
  
  services.forEach(([serviceName]) => {
    console.log(`Stopping service: ${serviceName}`);
    exec(`msb destroy --service ${serviceName}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error stopping ${serviceName}:`, stderr);
      } else {
        console.log(`${serviceName} stopped successfully`);
      }
    });
  });

  // Then delete the project network
  console.log(`Deleting network: ${projectName}`);
  exec(`msb network delete ${projectName}`, (error, stdout, stderr) => {
    if (error) {
      console.error('Network deletion failed:', stderr);
      process.exit(1);
    }
    console.log('Network deleted successfully');
  });
}