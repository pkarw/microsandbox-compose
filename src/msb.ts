import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Run an `msb` command and resolve when it finishes, preserving caller order.
 * Rejects with a clean error (stderr over message) on non-zero exit so the
 * caller can implement fail-fast-per-service semantics.
 */
export async function runMsb(command: string): Promise<void> {
  try {
    await execAsync(command);
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string };
    const detail = (err.stderr && err.stderr.trim()) || err.message || 'unknown error';
    throw new Error(detail.trim());
  }
}

/**
 * Create the project's private internal network. All sandboxes in a compose
 * project share this one network for service name resolution; a pre-existing
 * network is reused (idempotent re-`up`).
 */
export function createProjectNetwork(projectName: string): void {
  try {
    const out = execSync(`msb network create ${projectName} --internal`, { encoding: 'utf8' });
    console.log('Created network:', out.trim());
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string };
    const stderr = (err.stderr ?? err.message ?? '').toString();
    if (stderr.includes('already exists') || stderr.toLowerCase().includes('exist')) {
      console.log('Network already exists, reusing');
    } else {
      throw new Error(`Failed to create network ${projectName}: ${stderr.trim()}`);
    }
  }
}
