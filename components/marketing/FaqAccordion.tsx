"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface FaqItem {
  number: string;
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const reduced = useReducedMotion();

  return (
    <div className="bcp-faq">
      {items.map((faq, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={faq.number} className="bcp-faq-item-wrap">
            <button
              className="bcp-faq-item"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <div className="bcp-faq-left">
                <span className="bcp-faq-num">{faq.number}</span>
                <span>{faq.question}</span>
              </div>
              <motion.div
                className="bcp-faq-icon"
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: reduced ? 0 : 0.2, ease: "easeOut" }}
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                  <path d="M6 3V9M3 6H9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  className="bcp-faq-answer"
                  initial={reduced ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    duration: reduced ? 0 : 0.25,
                    ease: "easeOut",
                  }}
                  style={{ overflow: "hidden" }}
                >
                  <p>{faq.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
