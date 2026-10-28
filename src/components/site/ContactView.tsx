"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MessageCircle, CheckCircle2, Loader2, Mail, MapPin, Phone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  COMPANY,
  BUSINESS_TYPES,
  COUNTRIES,
  PROJECT_TYPES,
  BUDGET_RANGES,
  CONTACT_METHODS,
} from "@/data/site";
import { PageHero } from "./PageHero";
import { Reveal } from "./Reveal";

/* ------------------------------------------------------------------ */
/* Validation schema                                                   */
/* ------------------------------------------------------------------ */

const contactSchema = z.object({
  name: z.string().optional().refine((value) => !value || value.trim().length >= 2, "Enter at least two characters, or leave the name blank."),
  businessName: z.string().optional(),
  businessType: z.string().optional(),
  email: z.email("Enter a valid email address."),
  whatsapp: z.string().trim().refine(
    (value) => {
      if (value === "") return true;
      const digits = value.replace(/\D/g, "");
      return value.startsWith("+") && /^[+\d\s().-]+$/.test(value) && digits.length >= 8 && digits.length <= 15;
    },
    "If you share a number, use international format (for example +880 1XXXXXXXXX) or leave it blank.",
  ),
  country: z.string().optional(),
  projectType: z.string().optional(),
  budgetRange: z.string().optional(),
  details: z
    .string()
    .min(20, "Please describe the project in at least 20 characters."),
  preferredContact: z.string().min(1, "Select your preferred contact method."),
  consent: z.boolean().refine((v) => v === true, {
    message: "Please agree to the Privacy Policy so we can respond to you.",
  }),
});

type ContactFormValues = z.infer<typeof contactSchema>;

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export default function ContactView() {
  const [submitting, setSubmitting] = useState(false);
  const requestIdRef = useRef<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    clientId: string;
    message: string;
    emailDeliveryStatus: 'ACCEPTED_BY_PROVIDER' | 'NOT_CONFIRMED' | 'NOT_ATTEMPTED';
  } | null>(null);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      businessName: "",
      businessType: "",
      email: "",
      whatsapp: "",
      country: "",
      projectType: "",
      budgetRange: "",
      details: "",
      preferredContact: "Email",
      consent: false,
    },
  });

  const { subscribe } = form;

  useEffect(() => {
    // `watch()` is intentionally not used here: React Hook Form's `watch()`
    // cannot be memoized safely by the React Compiler. `subscribe()` gives us
    // the same "reset the idempotency key when the visitor edits the form"
    // behaviour without a memoization-incompatible API.
    return subscribe({
      formState: { values: true },
      callback: () => {
        requestIdRef.current = null;
      },
    });
  }, [subscribe]);

  const onSubmit = async (values: ContactFormValues) => {
    setSubmitting(true);
    setApiError(null);
    requestIdRef.current ??= newClientRequestId();
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestIdRef.current,
          name: values.name,
          businessName: values.businessName ?? "",
          businessType: values.businessType,
          email: values.email,
          whatsapp: values.whatsapp,
          country: values.country,
          projectType: values.projectType,
          budgetRange: values.budgetRange,
          details: values.details,
          preferredContact: values.preferredContact,
          consent: true,
          tracking: {
            ref: typeof document !== "undefined" ? document.referrer || null : null,
            path: typeof window !== "undefined" ? window.location.hash : null,
          },
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; clientId?: string; message?: string; error?: string; requestRef?: string | null; emailDeliveryStatus?: 'ACCEPTED_BY_PROVIDER' | 'NOT_CONFIRMED' | 'NOT_ATTEMPTED' }
        | null;
      if (!res.ok || !data?.ok) {
        // Honest error handling: show what we know, no fake success.
        setApiError(
          data?.error ??
            data?.message ??
            `The request could not be submitted (HTTP ${res.status}). Please try again — or start a live chat with our team.`
        );
        return;
      }
      requestIdRef.current = null;
      setSuccess({
        clientId: data.clientId ?? "—",
        message: data.message ?? "Your enquiry has been received.",
        emailDeliveryStatus: data.emailDeliveryStatus ?? 'NOT_ATTEMPTED',
      });
    } catch {
      setApiError(
        "Network error — the request never left your browser. Check your connection and try again, or start a live chat with our team."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main id="main-content">
      <PageHero
        eyebrow="Contact"
        title="Start your project — the scoped way"
        description="Share your email and a short project description first. Name, company, location, budget, and contact preferences can be added when relevant; a Client ID is issued only when the record can be safely matched."
        breadcrumb={[{ label: "Contact" }]}
      />

      <section aria-labelledby="contact-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-20">
          {/* Form column */}
          <div className="lg:col-span-7">
            <Reveal>
              <h2 id="contact-heading" className="text-2xl font-bold tracking-tight text-[#0B1F33] sm:text-3xl">
                Project enquiry form
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#526173]">
                Only email and a short project description are needed to start; profile details are optional. We use this enquiry for service-related follow-up, not as marketing consent. A Client ID is issued or linked only after a safe identity check.
              </p>
            </Reveal>

            {success ? (
              <Reveal className="mt-8">
                <Card className="border-[#18B83A]/40 bg-white" role="status">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start gap-4">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#18B83A]/10">
                        <CheckCircle2 className="size-6 text-[#18B83A]" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xl font-bold text-[#0B1F33]">
                          Enquiry received
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#526173]">
                          {success.message}
                        </p>
                        {success.emailDeliveryStatus === 'ACCEPTED_BY_PROVIDER' ? (
                          <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-800">
                            The mail service accepted the initial email; delivery to your inbox is not confirmed.
                          </p>
                        ) : (
                          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                            Email delivery was not confirmed. You can reach us directly at <a href="mailto:info@bdtech360.com" className="font-semibold underline">info@bdtech360.com</a>.
                          </p>
                        )}
                        <div className="mt-5 rounded-xl border border-[#063B8F]/20 bg-[#F4FAFF] p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#526173]">
                            Your reference ID
                          </p>
                          <p className="mt-1 break-all text-2xl font-bold tracking-tight text-[#063B8F]">
                            {success.clientId}
                          </p>
                          <p className="mt-2 text-xs leading-relaxed text-[#526173]">
                            Keep it for all future communication — quote it in
                            every message, email or call so your record stays
                            unified.
                          </p>
                        </div>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent("tech360:open-chat"))}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#18B83A] px-5 py-2.5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#16A433] focus-visible:ring-2 focus-visible:ring-[#18B83A] focus-visible:ring-offset-2"
                          >
                            <MessageCircle className="size-4" aria-hidden="true" />
                            Chat with our team
                          </button>
                          <a
                            href="#/process"
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#063B8F]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#063B8F] outline-none transition-colors hover:border-[#009FE3] hover:text-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
                          >
                            What happens next
                          </a>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
            ) : (
              <Reveal delay={0.1} className="mt-8">
                <Card className="border-[#E2E8F0] bg-white">
                  <CardContent className="p-6 sm:p-8">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
                        <div className="grid gap-6 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#0B1F33]">Name (optional)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Your full name"
                                    autoComplete="name"
                                    className="min-h-11 border-[#E2E8F0] focus-visible:ring-[#009FE3]/40"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="businessName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#0B1F33]">Business name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Company or brand (optional)"
                                    autoComplete="organization"
                                    className="min-h-11 border-[#E2E8F0] focus-visible:ring-[#009FE3]/40"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#0B1F33]">Email *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="email"
                                    inputMode="email"
                                    placeholder="you@company.com"
                                    autoComplete="email"
                                    className="min-h-11 border-[#E2E8F0] focus-visible:ring-[#009FE3]/40"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="whatsapp"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#0B1F33]">Phone / WhatsApp number (optional)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="tel"
                                    inputMode="tel"
                                    placeholder="+8801XXXXXXXXX (optional)"
                                    autoComplete="tel"
                                    className="min-h-11 border-[#E2E8F0] focus-visible:ring-[#009FE3]/40"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                                <p className="text-xs leading-relaxed text-[#64748B]">Email is the primary contact channel. We use this number only if you select Phone or WhatsApp.</p>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="businessType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#0B1F33]">Business type (optional)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="min-h-11 w-full border-[#E2E8F0] focus-visible:ring-[#009FE3]/40">
                                      <SelectValue placeholder="Select your business type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {BUSINESS_TYPES.map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {type}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#0B1F33]">Country (optional)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="min-h-11 w-full border-[#E2E8F0] focus-visible:ring-[#009FE3]/40">
                                      <SelectValue placeholder="Select your country" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {COUNTRIES.map((country) => (
                                      <SelectItem key={country} value={country}>
                                        {country}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="projectType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#0B1F33]">Project type (optional)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="min-h-11 w-full border-[#E2E8F0] focus-visible:ring-[#009FE3]/40">
                                      <SelectValue placeholder="What do you need built?" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {PROJECT_TYPES.map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {type}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="budgetRange"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#0B1F33]">Budget range (optional)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="min-h-11 w-full border-[#E2E8F0] focus-visible:ring-[#009FE3]/40">
                                      <SelectValue placeholder="Select a range" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {BUDGET_RANGES.map((range) => (
                                      <SelectItem key={range} value={range}>
                                        {range}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="details"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[#0B1F33]">Project details *</FormLabel>
                              <FormControl>
                                <Textarea
                                  rows={6}
                                  placeholder="What would you like to build or improve? A short description is enough to start (minimum 20 characters)."
                                  className="min-h-32 border-[#E2E8F0] focus-visible:ring-[#009FE3]/40"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid gap-6 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="preferredContact"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#0B1F33]">Preferred contact method (optional)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="min-h-11 w-full border-[#E2E8F0] focus-visible:ring-[#009FE3]/40">
                                      <SelectValue placeholder="How should we reach you?" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {CONTACT_METHODS.map((method) => (
                                      <SelectItem key={method} value={method}>
                                        {method}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex items-end">
                            <p className="text-xs leading-relaxed text-[#526173]">
                              Email is the primary contact channel. A Client ID
                              is issued or linked only when identity can be
                              handled safely; otherwise, the enquiry goes to
                              review without exposing another record.
                            </p>
                          </div>
                        </div>

                        <FormField
                          control={form.control}
                          name="consent"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-start gap-3 rounded-lg border border-[#E2E8F0] bg-[#F4FAFF] p-4">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={(v) => field.onChange(v === true)}
                                    className="mt-0.5 size-5 data-[state=checked]:bg-[#009FE3] data-[state=checked]:border-[#009FE3]"
                                    aria-label="Agree to the Privacy Policy"
                                  />
                                </FormControl>
                                <Label className="text-sm font-normal leading-relaxed text-[#526173]">
                                  I consent to TECH360 LLC storing this enquiry and using my email (and the contact method I select, if any) to respond and send service-related updates about this request. Marketing messages require a separate opt-in. See the{" "}
                                  <a
                                    href="#/legal/privacy"
                                    className="font-semibold text-[#009FE3] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[#009FE3] rounded-sm outline-none"
                                  >
                                    Privacy Policy
                                  </a>
                                  .
                                </Label>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {apiError ? (
                          <div
                            role="alert"
                            className="rounded-lg border border-[#B4472A]/30 bg-[#FDF3F0] p-4 text-sm leading-relaxed text-[#8A3420]"
                          >
                            {apiError}
                          </div>
                        ) : null}

                        <Button
                          type="submit"
                          disabled={submitting}
                          className="min-h-12 w-full rounded-lg bg-[#009FE3] text-sm font-semibold text-white hover:bg-[#0090CC] sm:w-auto sm:px-8"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                              Submitting enquiry…
                            </>
                          ) : (
                            <>
                              <Send className="size-4" aria-hidden="true" />
                              Submit project enquiry
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-[#526173]">
                          Your approved Scope of Work will identify any preview, its review process, and when payments are due.
                        </p>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </Reveal>
            )}
          </div>

          {/* Contact info column */}
          <div className="lg:col-span-5">
            <Reveal delay={0.15}>
              <h2 className="text-2xl font-bold tracking-tight text-[#0B1F33] sm:text-3xl">
                Direct channels
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#526173]">
                Prefer to start outside the form? Email is primary. A Client ID
                is used only when a record can be safely issued or linked; an
                unverified email is never used to merge customer records.
              </p>
            </Reveal>

            <div className="mt-8 space-y-5">
              <Reveal delay={0.2}>
                <Card className="border-[#E2E8F0] bg-white">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#009FE3]/10 text-[#009FE3]">
                        <Mail className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#0B1F33]">Email</h3>
                        <a
                          href={`mailto:${COMPANY.email}`}
                          className="mt-1 block break-all text-sm font-medium text-[#009FE3] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[#009FE3] rounded-sm outline-none"
                        >
                          {COMPANY.email}
                        </a>
                        <p className="mt-2 text-xs leading-relaxed text-[#526173]">
                          Best for detailed briefs and document attachments.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>

              <Reveal delay={0.25}>
                <Card className="border-[#E2E8F0] bg-white">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#18B83A]/10 text-[#18B83A]">
                        <MessageCircle className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#0B1F33]">Live support chat</h3>
                        <button
                          type="button"
                          onClick={() => window.dispatchEvent(new CustomEvent("tech360:open-chat"))}
                          className="mt-1 block min-h-9 text-sm font-medium text-[#009FE3] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[#009FE3] rounded-sm outline-none"
                        >
                          Open the chat now
                        </button>
                        <p className="mt-2 text-xs leading-relaxed text-[#526173]">
                          Fastest first response — our support team replies
                          quickly, brings in specialists when needed, and every message lands
                          on your client record.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>

              <Reveal delay={0.3}>
                <Card className="border-[#E2E8F0] bg-white">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#063B8F]/10 text-[#063B8F]">
                        <MapPin className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#0B1F33]">Registered office</h3>
                        <address className="mt-1 text-sm not-italic leading-relaxed text-[#526173]">
                          {COMPANY.legalName}
                          <br />
                          {COMPANY.address}
                        </address>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>

              <Reveal delay={0.35}>
                <div className="rounded-xl border border-[#009FE3]/30 bg-[#F4FAFF] p-6">
                  <h3 className="text-sm font-semibold text-[#0B1F33]">
                    What happens after you send
                  </h3>
                  <ol className="mt-4 space-y-3">
                    {[
                      "Start with your email and a short project description; profile details are optional.",
                      "We issue or link a Client ID only when we can do so safely; possible identity collisions go to review.",
                      "If you proceed, the project scope is documented; an HTML Preview is provided where included in the agreed process.",
                      "The approved Scope of Work defines any required preview approval and the applicable payment schedule.",
                    ].map((step, i) => (
                      <li key={step} className="flex items-start gap-3 text-sm leading-relaxed text-[#526173]">
                        <span
                          aria-hidden="true"
                          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#009FE3]/10 text-xs font-bold text-[#009FE3]"
                        >
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
