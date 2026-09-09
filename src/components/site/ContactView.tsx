"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, Mail, MapPin, Phone, Send } from "lucide-react";
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
  name: z.string().min(2, "Please enter your full name."),
  businessName: z.string().optional(),
  businessType: z.string().min(1, "Select your business type."),
  email: z.email("Enter a valid email address."),
  whatsapp: z
    .string()
    .min(7, "Enter a reachable WhatsApp number including country code."),
  country: z.string().min(1, "Select your country."),
  projectType: z.string().min(1, "Select the type of project."),
  budgetRange: z.string().min(1, "Select a budget range (or the guidance option)."),
  details: z
    .string()
    .min(30, "Please describe your project in at least 30 characters — the more specific, the sharper the scope."),
  preferredContact: z.string().min(1, "Select your preferred contact method."),
  consent: z.boolean().refine((v) => v === true, {
    message: "Please agree to the Privacy Policy so we can respond to you.",
  }),
});

type ContactFormValues = z.infer<typeof contactSchema>;

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export default function ContactView() {
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ clientId: string; message: string } | null>(null);

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
      preferredContact: "WhatsApp",
      consent: false,
    },
  });

  const onSubmit = async (values: ContactFormValues) => {
    setSubmitting(true);
    setApiError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        | { ok?: boolean; clientId?: string; message?: string; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        // Honest error handling: show what we know, no fake success.
        setApiError(
          data?.error ??
            data?.message ??
            `The request could not be submitted (HTTP ${res.status}). Please try again or reach us directly on WhatsApp.`
        );
        return;
      }
      setSuccess({
        clientId: data.clientId ?? "—",
        message:
          data.message ??
          "Your enquiry has been received. Our team will respond within one business day.",
      });
    } catch {
      setApiError(
        "Network error — the request never left your browser. Check your connection and try again, or message us on WhatsApp."
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
        description="One form. You receive a Client ID immediately, a written scope after discovery, and an HTML preview before any payment decision."
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
                Fields marked with an asterisk are required. Your details go
                into our delivery system against a Client ID — never into a
                mailing list.
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
                          <a
                            href={COMPANY.whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#18B83A] px-5 py-2.5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#16A433] focus-visible:ring-2 focus-visible:ring-[#18B83A] focus-visible:ring-offset-2"
                          >
                            <Phone className="size-4" aria-hidden="true" />
                            Message us on WhatsApp
                          </a>
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
                                <FormLabel className="text-[#0B1F33]">Name *</FormLabel>
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
                                <FormLabel className="text-[#0B1F33]">WhatsApp number *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="tel"
                                    inputMode="tel"
                                    placeholder="+880 1XXX-XXXXXX"
                                    autoComplete="tel"
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
                            name="businessType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#0B1F33]">Business type *</FormLabel>
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
                                <FormLabel className="text-[#0B1F33]">Country *</FormLabel>
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
                                <FormLabel className="text-[#0B1F33]">Project type *</FormLabel>
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
                                <FormLabel className="text-[#0B1F33]">Budget range *</FormLabel>
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
                                  placeholder="What are you building? What problem should it solve? Any deadline or existing system we should know about? (minimum 30 characters)"
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
                                <FormLabel className="text-[#0B1F33]">Preferred contact method *</FormLabel>
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
                              Response within one business day. Your enquiry
                              creates a Client ID immediately — every follow-up
                              is tracked against it.
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
                                  I agree that TECH360 LLC may process the
                                  information above to respond to my enquiry,
                                  as described in the{" "}
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
                          No payment, no commitment — the next step is a
                          written scope you approve.
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
                Prefer to start the conversation outside the form? Every
              channel below reaches the same team — and the same Client ID
              record.
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
                        <Phone className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#0B1F33]">WhatsApp</h3>
                        <a
                          href={COMPANY.whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block text-sm font-medium text-[#009FE3] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[#009FE3] rounded-sm outline-none"
                        >
                          {COMPANY.whatsappDisplay}
                        </a>
                        <p className="mt-2 text-xs leading-relaxed text-[#526173]">
                          Fastest first response — messages arrive in our
                          system, not a personal phone.
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
                        <p className="mt-2 text-xs text-[#526173]">
                          Missouri LLC {COMPANY.missouriLLC} · EIN {COMPANY.ein}
                        </p>
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
                      "Your Client ID is issued immediately and shown on screen.",
                      "Discovery questions arrive within one business day.",
                      "A written scope follows — then an HTML preview for your approval.",
                      "Payment is discussed only after you approve the preview.",
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
