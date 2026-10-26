import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const OUTPUT_DIR = '/home/z/my-project/tech360-laravel/public/images';

const remaining = [
  { prompt: 'A sleek dark and light mode command center UI dashboard mockup, minimal graph lines, automated task cards moving along a pipeline stage, clean typography, glowing status dots, vector graphics', size: '1344x768', filename: 'admin-dashboard.png' },
  { prompt: 'Modern cloud infrastructure architecture diagram, clean vector style, showing user request flowing through CDN, application server, cache, database, soft blue cyan green gradient', size: '1344x768', filename: 'cloud-architecture.png' },
  { prompt: 'Clean modern CRM dashboard interface mockup, lead pipeline stages, contact cards, analytics charts, blue and green accents, white background, vector style', size: '1344x768', filename: 'crm-dashboard.png' },
  { prompt: 'Software development lifecycle visualization, requirement architecture development testing deployment stages as connected nodes, navy blue cyan green colors', size: '1344x768', filename: 'dev-lifecycle.png' },
  { prompt: 'Quality assurance checklist, code quality UI responsiveness database security performance SEO deployment items with green checkmarks, clean modern UI, vector style', size: '1024x1024', filename: 'quality-checklist.png' },
  { prompt: 'Premium 3D isometric website browser mockup, modern responsive website, blue and green gradient accents, glassmorphism style, vector aesthetic', size: '1344x768', filename: 'website-mockup.png' },
  { prompt: 'Project delivery handover visualization, completed project quality verified badge admin approved client delivery, navy blue cyan green colors', size: '1344x768', filename: 'delivery-handover.png' },
  { prompt: 'Security architecture visualization, HTTPS Cloudflare WAF Laravel authentication RBAC database audit log shield diagram, blue and green colors', size: '1024x1024', filename: 'security-architecture.png' },
];

async function main() {
  const zai = await ZAI.create();
  for (const img of remaining) {
    try {
      console.log('Generating:', img.filename);
      const res = await zai.images.generations.create({ prompt: img.prompt, size: img.size });
      const buf = Buffer.from(res.data[0].base64, 'base64');
      fs.writeFileSync(OUTPUT_DIR + '/' + img.filename, buf);
      console.log('  ✓', Math.round(buf.length / 1024), 'KB');
    } catch (e) {
      console.log('  ✗', e.message);
    }
  }
  console.log('Done!');
}
main();
