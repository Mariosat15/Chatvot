"use client";

import { motion } from "framer-motion";
import { Check, ChevronRight, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import DemoScheduler from "./DemoScheduler";

interface PricingTier {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  ctaText: string;
  highlighted: boolean;
  enabled: boolean;
  order: number;
}

interface EnterprisePricingContactProps {
  // Pricing
  showPricing: boolean;
  pricingTitle: string;
  pricingSubtitle: string;
  pricingTiers: PricingTier[];
  // Contact
  showContact: boolean;
  contactTitle: string;
  contactSubtitle: string;
  contactEmail: string;
  contactPhone?: string;
  contactCTAText: string;
  demoScheduling?: {
    enabled: boolean;
    calendlyUrl: string;
    buttonText: string;
  };
}

export default function EnterprisePricingContact({
  showPricing,
  pricingTitle,
  pricingSubtitle,
  pricingTiers,
  showContact,
  contactTitle,
  contactSubtitle,
  contactEmail,
  contactPhone,
  contactCTAText,
  demoScheduling,
}: EnterprisePricingContactProps) {
  return (
    <>
      {/* Pricing Section */}
      {showPricing && (
        <section id="pricing" className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-black mb-4 text-white">
                {pricingTitle}
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                {pricingSubtitle}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {pricingTiers.map((tier, index) => (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className={`relative p-8 rounded-2xl ${
                    tier.highlighted
                      ? "bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-2 border-purple-500"
                      : "bg-gray-900/50 border border-gray-800"
                  }`}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {tier.name}
                  </h3>
                  <div className="mb-4">
                    <span className="text-4xl font-black text-white">
                      {tier.price}
                    </span>
                    <span className="text-gray-400">{tier.period}</span>
                  </div>
                  <p className="text-gray-400 mb-6">{tier.description}</p>
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-3 text-gray-300"
                      >
                        <Check className="h-5 w-5 text-green-500 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a href="#contact">
                    <Button
                      className={`w-full font-bold ${
                        tier.highlighted
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white"
                          : "bg-gray-800 hover:bg-gray-700 text-white"
                      }`}
                      size="lg"
                    >
                      {tier.ctaText}
                    </Button>
                  </a>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact Section */}
      {showContact && (
        <section
          id="contact"
          className="py-24 bg-gradient-to-b from-gray-900/50 to-gray-950"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl md:text-5xl font-black mb-4 text-white">
                {contactTitle}
              </h2>
              <p className="text-gray-400 text-lg">{contactSubtitle}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-2xl bg-gray-900/50 border border-gray-800"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <a
                  href={`mailto:${contactEmail}`}
                  className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Email Us</p>
                    <p className="text-white font-medium">{contactEmail}</p>
                  </div>
                </a>
                <a
                  href={`tel:${contactPhone?.replace(/\D/g, "")}`}
                  className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center">
                    <Phone className="h-6 w-6 text-pink-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Call Us</p>
                    <p className="text-white font-medium">{contactPhone}</p>
                  </div>
                </a>
              </div>
              <div className="text-center">
                <p className="text-gray-400 mb-4">
                  Or schedule a demo call with our team
                </p>
                {demoScheduling?.enabled && demoScheduling?.calendlyUrl ? (
                  <DemoScheduler
                    effectiveColors={{
                      primary: "#a855f7",
                      secondary: "#ec4899",
                      accent: "#fbbf24",
                      text: "#ffffff",
                    }}
                    effectiveHeadingFont="inherit"
                    calendlyUrl={demoScheduling.calendlyUrl}
                    buttonText={
                      demoScheduling.buttonText || contactCTAText
                    }
                  />
                ) : (
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold px-12"
                  >
                    {contactCTAText}
                    <ChevronRight className="h-5 w-5 ml-2" />
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        </section>
      )}
    </>
  );
}
