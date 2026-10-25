// Shared types for the AI Workforce UI, mirroring the API responses.

export interface Department {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  company: { id: string; slug: string; name: string };
  _count: { agents: number };
}

export interface AgentSummary {
  id: string;
  slug: string;
  name: string;
  role: string;
  status: string;
  version: number;
  humanApprovalRequired: boolean;
  department: { id: string; slug: string; name: string };
  _count: {
    skills: number;
    prompts: number;
    executions: number;
    permissions: number;
  };
}

export interface AgentDetail {
  id: string;
  slug: string;
  name: string;
  role: string;
  description: string;
  businessPurpose: string;
  responsibilities: string;
  inputSchema: string;
  outputSchema: string;
  systemInstructions: string;
  version: number;
  status: string;
  skillPath: string;
  memoryPolicy: string;
  ragPolicy: string;
  safetyPolicy: string;
  humanApprovalRequired: boolean;
  escalationRules: string;
  timeoutPolicy: number;
  retryPolicy: string;
  auditPolicy: string;
  department: { id: string; slug: string; name: string; description: string | null };
  capabilities: Array<{ id: string; name: string; description: string | null }>;
  skills: Array<{
    id: string;
    proficiency: string;
    skill: { id: string; slug: string; name: string; category: string; description: string };
  }>;
  prompts: Array<{
    id: string;
    slug: string;
    name: string;
    description: string;
    template: string;
    variables: string;
    promptType: string;
  }>;
  permissions: Array<{ id: string; resource: string; action: string; constraints: string }>;
  tools: Array<{
    id: string;
    tool: { id: string; slug: string; name: string; description: string; type: string };
  }>;
  modelRoutingPolicy: {
    id: string;
    slug: string;
    name: string;
    primaryModel: { id: string; slug: string; name: string } | null;
    fallbackModelIds: string;
  } | null;
  fallbackPolicy: {
    id: string;
    slug: string;
    name: string;
    strategy: string;
    maxRetries: number;
    backoffMs: number;
  } | null;
  versions: Array<{ id: string; version: number; changelog: string | null; createdAt: string }>;
  feedback: Array<{ id: string; rating: number; comment: string | null; createdAt: string }>;
  incidents: Array<{ id: string; severity: string; type: string; description: string; status: string; createdAt: string }>;
  evaluations: Array<{
    id: string;
    name: string;
    status: string;
    metrics: Array<{ id: string; name: string; value: number | null; target: number | null; unit: string | null }>;
  }>;
  _count: {
    skills: number;
    prompts: number;
    executions: number;
    permissions: number;
    memory: number;
  };
}

export interface ExecutionSummary {
  id: string;
  status: string;
  durationMs: number | null;
  modelUsed: string | null;
  tokenInput: number | null;
  tokenOutput: number | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  agent: {
    id: string;
    slug: string;
    name: string;
    role: string;
    department: { slug: string; name: string } | null;
  };
}

export interface ExecutionLog {
  id: string;
  level: string;
  message: string;
  metadata: string | null;
  createdAt: string;
}

export interface ExecutionDetail {
  id: string;
  input: string;
  output: string | null;
  status: string;
  durationMs: number | null;
  tokenInput: number | null;
  tokenOutput: number | null;
  modelUsed: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  agent: {
    id: string;
    slug: string;
    name: string;
    role: string;
    department: { slug: string; name: string } | null;
  };
  logs: ExecutionLog[];
  results: Array<{ id: string; key: string; value: string; type: string }>;
}

export interface ApprovalRequest {
  id: string;
  action: string;
  payload: string;
  status: string;
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  agent: {
    id: string;
    slug: string;
    name: string;
    role: string;
    department: { slug: string; name: string } | null;
  };
}

export interface SkillSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  status: string;
  version: number;
  _count: { agents: number };
}

export interface Stats {
  counts: {
    totalAgents: number;
    activeAgents: number;
    totalSkills: number;
    totalPrompts: number;
    totalSops: number;
    totalDepartments: number;
    executionsToday: number;
    pendingApprovals: number;
    openIncidents: number;
    totalExecutions: number;
    totalTools: number;
    totalModels: number;
  };
  executionsOverTime: Array<{ day: string; total: number; success: number; failed: number }>;
  executionsByDepartment: Array<{ slug: string; name: string; count: number }>;
  successRate: number;
}

export interface ModelProvider {
  id: string;
  slug: string;
  name: string;
  apiBase: string | null;
  apiKeyEnv: string | null;
  status: string;
  models: Array<{
    id: string;
    slug: string;
    name: string;
    contextWindow: number;
    inputCostPer1k: number | null;
    outputCostPer1k: number | null;
    capabilities: string;
    status: string;
    capabilities_rel: Array<{ id: string; capability: string; score: number }>;
    _count: { routingPolicies: number };
  }>;
}

export interface Incident {
  id: string;
  severity: string;
  type: string;
  description: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  agent: {
    id: string;
    slug: string;
    name: string;
    role: string;
    department: { slug: string; name: string } | null;
  };
}
