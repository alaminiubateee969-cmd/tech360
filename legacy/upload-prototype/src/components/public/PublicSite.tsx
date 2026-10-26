"use client";

import * as React from "react";
import { Hero } from "./Hero";
import { ServicesGrid } from "./ServicesGrid";
import { IndustriesSection } from "./IndustriesSection";
import { BeforeAfterSection } from "./BeforeAfterSection";
import { HowItWorks } from "./HowItWorks";
import { TrustSection } from "./TrustSection";
import { PricingTeaser } from "./PricingTeaser";
import { ContactForm } from "./ContactForm";
import { Footer } from "./Footer";

export function PublicSite() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col">
      <Hero />
      <ServicesGrid />
      <IndustriesSection />
      <BeforeAfterSection />
      <HowItWorks />
      <TrustSection />
      <PricingTeaser />
      <ContactForm />
      <div className="mt-auto">
        <Footer />
      </div>
    </main>
  );
}
