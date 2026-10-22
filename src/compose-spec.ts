import * as fs from 'fs';
import * as yaml from 'yaml';
import { ComposeProject } from './types';

export function parseComposeFile(filePath: string): ComposeProject {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = yaml.parse(content);
    return data as ComposeProject;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to read compose file: ${error.message}`);
    }
    throw new Error('Failed to read compose file: Unknown error');
  }
}