export interface ComposeProject {
  name: string;
  services: Record<string, ComposeService>;
}

export interface ComposeService {
  image: string;
  command: string[];
  env?: Record<string, string>;
  ports?: string[];
  volumes?: string[];
}