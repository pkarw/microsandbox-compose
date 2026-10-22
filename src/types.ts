export interface ComposeProject {
  name?: string;
  services: Record<string, ComposeService>;
  // Top-level `volumes` and `networks` are parsed but ignored in MVP:
  // named volumes are unsupported and all services share one internal network.
  volumes?: Record<string, unknown>;
  networks?: Record<string, unknown>;
}

export interface ComposeService {
  // MVP supported fields (Phase 1 mapping)
  image: string;
  command?: string[];
  entrypoint?: string[];
  env?: Record<string, string>;
  ports?: string[];
  volumes?: string[];
  profiles?: string[];
  depends_on?: string[];
  cpus?: string;
  memory?: string;
  // MVP unsupported / parsed-but-unused fields
  env_file?: string[];
  restart?: string;
  healthcheck?: unknown;
  networks?: string[];
}
