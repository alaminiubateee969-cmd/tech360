# BDTECH360 — Database Setup

## Schema Overview (116+ models)

### CRM Core
- User, Lead, Client, Project, Communication, Scope, Payment, Approval, FileItem, Staff, KnowledgeArticle, AuditLog

### Client Journey
- ClientJourneyStep (23-step lifecycle), Task, Invoice, Meeting, Evidence, Review, ProjectMilestone, ScopeVersion, PasswordChangeConfirmation

### Content
- BlogPost, LegalPage, EmailLog

### AI Workforce
- AICompany, AIDepartment, AIAgent, AIAgentVersion, AIAgentCapability, AIAgentSkill, AISkill, AIPrompt, AISOP, AIAgentPermission, AIAgentTool, AIModel, AIModelRoutingPolicy, AIFallbackPolicy

### Enterprise Expansion
- AIConstitutionalRule, AIKnowledgeNode, AIKnowledgeEdge, AIDepartmentCapabilityCertification, AIMCPServer, AIMCPTool, AIDataLakeDataset, AIAPIGatewayRoute, AIEvent, AIObservabilityMetric, AIObservabilityAlert

### Super Admin
- AIAgentHierarchy, AIAgentResourceQuota, AIAgentCreationRequest, NLCommand, AIPlan, AIReflection, AISelfHealingAction, AISelfOptimizationTuning, AIGovernanceDecision, AIComplianceCheck

### Legal/Compliance
- CommunicationLedger (immutable audit), StructuredApproval (SOW versioning), DeliveryRelease (payment-gated), PreviewLink, RateCard, ProjectEstimate

## MySQL Setup
```sql
CREATE DATABASE db_bdtech CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'user_bdtech'@'127.0.0.1' IDENTIFIED BY 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON db_bdtech.* TO 'user_bdtech'@'127.0.0.1';
FLUSH PRIVILEGES;
```

## Seed Order
1. `npx tsx prisma/seed.ts` — CRM data (users, leads, projects, etc.)
2. `npx tsx scripts/generate_ai_workforce.ts` — 100 depts, 2,000 agents, 50,000 prompts
3. `npx tsx scripts/generate_phase7.ts` — 500 rules, 100 DCC, MCP, data lake
4. `npx tsx scripts/seed_content.ts` — 5 legal pages, 5 blog posts, 5 reviews

## Default Login
- Email: admin@bdtech360.com
- Password: admin123
- Role: SUPER_ADMIN
