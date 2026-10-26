type JobHandler = (job: Record<string, unknown>) => Promise<void>;
interface QueueEntry { data: Record<string, unknown> }

class MemoryQueue {
  private queues = new Map<string, QueueEntry[]>();
  private handlers = new Map<string, JobHandler>();
  private interval: NodeJS.Timeout | null = null;
  constructor() { this.start(); }
  async enqueue(q: string, data: Record<string, unknown>) { if (!this.queues.has(q)) this.queues.set(q, []); this.queues.get(q)!.push({ data }); }
  async dequeue(q: string) { const queue = this.queues.get(q); return queue && queue.length > 0 ? queue.shift()!.data : null; }
  async length(q: string) { return this.queues.get(q)?.length || 0; }
  registerHandler(t: string, h: JobHandler) { this.handlers.set(t, h); }
  private start() { if (this.interval) return; this.interval = setInterval(async () => { for (const [q, queue] of this.queues) { while (queue.length > 0) { const e = queue.shift()!; const h = this.handlers.get(e.data.type as string); if (h) try { await h(e.data); } catch (err) { console.error("[queue]", err); } } } }, 2000); }
}

let inst: MemoryQueue | null = null;
function getQ(): MemoryQueue { if (!inst) inst = new MemoryQueue(); return inst; }
export async function enqueue(q: string, data: Record<string, unknown>) { return getQ().enqueue(q, data); }
export async function dequeue(q: string) { return getQ().dequeue(q); }
export function registerJobHandler(t: string, h: JobHandler) { return getQ().registerHandler(t, h); }
