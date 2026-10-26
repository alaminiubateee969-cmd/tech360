import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const OUTPUT_DIR = '/home/z/my-project/tech360-laravel/public/images';

// Ensure directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const images = [
  {
    prompt: "A modern tech platform product mockup floating in a light clean studio background, minimalist glassmorphism style, stylized dashboard cards showing analytics graphs and process flows, soft pastel blue and gray colors, subtle drop shadows, high clarity, vector aesthetic, zero real human faces, 8k resolution, SaaS UI style",
    size: '1344x768',
    filename: 'hero-platform.png'
  },
  {
    prompt: "A set of 4 isometric clean 3D software module cards, minimalist icon style, soft white and light blue gradient backdrop, showing abstract data nodes, workflow connections, modern UI UX interface, high visual depth, sleek tech aesthetic",
    size: '1024x1024',
    filename: 'features-modules.png'
  },
  {
    prompt: "A sleek dark and light mode command center UI dashboard mockup, minimal graph lines, automated task cards moving along a pipeline stage, clean typography, glowing status dots, micro-interactions preview, vector graphics",
    size: '1344x768',
    filename: 'admin-dashboard.png'
  },
  {
    prompt: "Modern cloud infrastructure architecture diagram, clean vector style, showing user request flowing through CDN, application server, cache layer, database, with soft blue cyan green gradient, technology illustration",
    size: '1344x768',
    filename: 'cloud-architecture.png'
  },
  {
    prompt: "Clean modern CRM dashboard interface mockup, showing lead pipeline stages, contact cards, analytics charts, task list, professional UI design, blue and green accents, white background, vector style",
    size: '1344x768',
    filename: 'crm-dashboard.png'
  },
  {
    prompt: "Animated business automation workflow visualization, showing trigger, rule, task, notification, completion nodes connected by glowing data flow lines, clean vector style, blue cyan green gradient, technology illustration",
    size: '1344x768',
    filename: 'automation-workflow.png'
  },
  {
    prompt: "Software development lifecycle visualization, showing requirement, architecture, development, testing, deployment stages as connected nodes, clean modern vector illustration, navy blue cyan green colors",
    size: '1344x768',
    filename: 'dev-lifecycle.png'
  },
  {
    prompt: "Quality assurance checklist visualization, showing code quality, UI responsiveness, database, security, performance, SEO, deployment items with green checkmarks, clean modern UI card design, vector style",
    size: '1024x1024',
    filename: 'quality-checklist.png'
  },
  {
    prompt: "Technology stack visualization showing Laravel PHP MySQL Cloudflare Bootstrap JavaScript Vite as connected technology nodes, clean modern vector illustration, blue cyan green gradient background",
    size: '1344x768',
    filename: 'tech-stack.png'
  },
  {
    prompt: "Security architecture visualization, showing HTTPS, Cloudflare WAF, Laravel authentication, RBAC, database, audit log layers as a shield diagram, clean vector style, blue and green colors",
    size: '1024x1024',
    filename: 'security-architecture.png'
  },
  {
    prompt: "Premium 3D isometric website browser mockup on clean white background, showing a modern responsive website with navigation, hero section, cards, soft blue and green gradient accents, glassmorphism style, vector aesthetic",
    size: '1344x768',
    filename: 'website-mockup.png'
  },
  {
    prompt: "Project delivery handover visualization, showing completed project, quality verified badge, admin approved stamp, client delivery box, clean modern vector illustration, navy blue cyan green colors, professional",
    size: '1344x768',
    filename: 'delivery-handover.png'
  }
];

async function generateAll() {
  console.log(`Generating ${images.length} premium images for TECH360...\n`);
  
  const zai = await ZAI.create();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const outputPath = `${OUTPUT_DIR}/${img.filename}`;
    
    try {
      console.log(`[${i + 1}/${images.length}] Generating: ${img.filename}`);
      console.log(`  Prompt: ${img.prompt.substring(0, 80)}...`);
      console.log(`  Size: ${img.size}`);
      
      const response = await zai.images.generations.create({
        prompt: img.prompt,
        size: img.size
      });

      if (!response.data || !response.data[0] || !response.data[0].base64) {
        throw new Error('Invalid response from image generation API');
      }

      const imageBase64 = response.data[0].base64;
      const buffer = Buffer.from(imageBase64, 'base64');
      fs.writeFileSync(outputPath, buffer);
      
      const fileSizeKB = Math.round(buffer.length / 1024);
      console.log(`  ✓ Saved: ${outputPath} (${fileSizeKB} KB)\n`);
      success++;
    } catch (error) {
      console.error(`  ✗ Failed: ${img.filename} - ${error.message}\n`);
      failed++;
    }
  }

  console.log(`\n=== IMAGE GENERATION COMPLETE ===`);
  console.log(`✓ Success: ${success}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Total: ${images.length}`);
  
  // List all generated images
  console.log(`\n=== GENERATED IMAGES ===`);
  const files = fs.readdirSync(OUTPUT_DIR);
  for (const file of files) {
    const stats = fs.statSync(`${OUTPUT_DIR}/${file}`);
    console.log(`  ${file} - ${Math.round(stats.size / 1024)} KB`);
  }
}

generateAll().catch(console.error);
