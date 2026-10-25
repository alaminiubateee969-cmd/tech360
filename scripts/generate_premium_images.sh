#!/bin/bash
# Generate high-quality premium images for Tech360 public website
set -e
IMG_DIR="/home/z/my-project/tech360-laravel/public/images"
mkdir -p "$IMG_DIR"

echo "🎨 Generating premium images for Tech360..."

# 1. Hero — enterprise AI command center dashboard (1440x720 wide)
z-ai image -p "Premium enterprise software dashboard UI, dark navy blue and electric blue gradient theme, AI command center interface with multiple data panels, CRM pipeline visualization, real-time analytics charts, modern glassmorphism cards, professional fintech aesthetic, ultra clean typography, 4K quality, sophisticated enterprise technology" -o "$IMG_DIR/hero-platform-v2.png" -s 1440x720 &

# 2. CRM dashboard (1344x768 landscape)
z-ai image -p "Modern CRM dashboard interface, light theme with blue accents, leads pipeline kanban board, sales analytics charts, contact management table, deal stages visualization, professional SaaS UI design, clean white cards with subtle shadows, premium enterprise software aesthetic, ultra detailed" -o "$IMG_DIR/crm-dashboard-v2.png" -s 1344x768 &

# 3. Cloud architecture (1344x768)
z-ai image -p "Enterprise cloud architecture diagram, multi-tier infrastructure visualization, load balancer connected to web servers and database clusters, CDN edge nodes, security firewalls, dark navy background with glowing blue and green connection lines, professional DevOps diagram, 3D isometric perspective, ultra detailed technology illustration" -o "$IMG_DIR/cloud-architecture-v2.png" -s 1344x768 &

# 4. Automation workflow (1344x768)
z-ai image -p "Business automation workflow diagram, visual node-based flowchart with trigger nodes, condition branches, action nodes, connected by flowing animated lines, blue and green gradient theme, dark background, modern n8n-style workflow builder interface, premium enterprise software UI, ultra clean design" -o "$IMG_DIR/automation-workflow-v2.png" -s 1344x768 &

# 5. Security architecture (1344x768)
z-ai image -p "Cybersecurity architecture visualization, shield and lock icons, layered defense system diagram, firewall, encryption layers, authentication gates, audit log panels, dark navy background with glowing green security indicators, professional enterprise security dashboard, ultra detailed, premium technology illustration" -o "$IMG_DIR/security-architecture-v2.png" -s 1344x768 &

wait
echo "✅ Batch 1 complete (hero, CRM, cloud, automation, security)"

# 6. Development lifecycle (1344x768)
z-ai image -p "Software development lifecycle infographic, circular flow diagram with 7 phases, scope approval, payment, development, QA, delivery, support, connected by gradient arrows, blue and green theme, clean white background, professional enterprise process diagram, ultra detailed, modern flat design" -o "$IMG_DIR/dev-lifecycle-v2.png" -s 1344x768 &

# 7. Admin dashboard (1344x768)
z-ai image -p "Super admin dashboard interface, dark sidebar navigation with icons, top metrics cards showing clients projects payments, data tables with status badges, AI agent status panel, activity timeline, modern enterprise admin panel UI, navy blue and white theme with green accents, ultra premium software design" -o "$IMG_DIR/admin-dashboard-v2.png" -s 1344x768 &

# 8. Tech stack (1344x768)
z-ai image -p "Technology stack visualization, layered architecture diagram showing Laravel PHP MySQL Apache icons, frontend backend database cloud layers, blue gradient background with glowing tech icons, modern enterprise tech stack illustration, ultra clean professional design" -o "$IMG_DIR/tech-stack-v2.png" -s 1344x768 &

# 9. Delivery handover (1344x768)
z-ai image -p "Project delivery and handover process, 5-gate authorization flow, source code package with lock icon, key handover visualization, checklist with green checkmarks, blue gradient background, professional enterprise delivery process diagram, ultra detailed" -o "$IMG_DIR/delivery-handover-v2.png" -s 1344x768 &

wait
echo "✅ Batch 2 complete (lifecycle, admin, tech stack, delivery)"
echo ""
echo "=== Generated images ==="
ls -lh $IMG_DIR/*-v2.png 2>/dev/null
