"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const CONTACT_INFO = [
  { label: "WhatsApp", value: "+880 1327-100297", href: "https://wa.me/8801327100297" },
  { label: "Email", value: "info@bdtech360.com", href: "mailto:info@bdtech360.com" },
  { label: "Website", value: "bdtech360.com", href: "https://bdtech360.com" },
];

export function ContactForm() {
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: data.get("name"),
      email: data.get("email"),
      company: data.get("company"),
      phone: data.get("phone"),
      message: data.get("message"),
    };
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to submit");
      toast.success("Thanks! Our team will reach out within one business day.");
      form.reset();
    } catch {
      toast.error("Something went wrong. Please try WhatsApp instead.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="contact" className="border-y border-border/40 bg-card/30">
      <div className="mx-auto max-w-[1400px] px-4 py-16 md:px-6 md:py-24">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Left — pitch */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Get in touch
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Let&apos;s build your operating system
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Tell us where you are and where you want to go. We&apos;ll send a
              tailored plan within one business day — no sales pressure, ever.
            </p>

            <div className="mt-8 space-y-3">
              {CONTACT_INFO.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 p-4 transition-all hover:border-primary/40 hover:bg-primary/4"
                >
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {c.label}
                  </span>
                  <span className="font-medium">{c.value}</span>
                </a>
              ))}
            </div>
          </motion.div>

          {/* Right — form */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-6 md:p-8">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name *</Label>
                    <Input id="name" name="name" required placeholder="Imran Khan" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Work email *</Label>
                    <Input id="email" name="email" type="email" required placeholder="imran@company.com" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input id="company" name="company" placeholder="Apex Realty" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" placeholder="+880 1XXX-XXXXXX" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">What are you trying to build?</Label>
                  <Textarea
                    id="message"
                    name="message"
                    rows={5}
                    placeholder="We need a CRM + WhatsApp automation for our 12-person sales team..."
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full gap-2"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Send to TECH360
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  By submitting, you agree to be contacted about your inquiry.
                </p>
              </form>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
