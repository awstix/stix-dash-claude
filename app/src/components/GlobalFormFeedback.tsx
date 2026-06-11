"use client";

import { useEffect, useRef, useState } from "react";

const storedFeedbackKey = "stix.formFeedback.done";

type FeedbackState = {
  tone: "pending" | "success";
  text: string;
};

function getSubmitterText(submitter: HTMLElement | null) {
  return String(submitter?.textContent ?? submitter?.getAttribute("title") ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function getFeedbackTexts(form: HTMLFormElement, submitter: HTMLElement | null) {
  const submitterText = getSubmitterText(submitter).toLowerCase();
  const method = String(form.getAttribute("method") ?? form.method ?? "get")
    .toLowerCase()
    .trim();
  const action = String(form.getAttribute("action") ?? "").toLowerCase();

  if (
    method === "get" &&
    !submitterText.includes("speicher") &&
    !submitterText.includes("lösch") &&
    !submitterText.includes("loesch")
  ) {
    return null;
  }

  if (
    submitterText.includes("filter") ||
    submitterText.includes("export") ||
    submitterText.includes("anzeigen") ||
    submitterText.includes("öffnen") ||
    submitterText.includes("oeffnen") ||
    action.includes("/export")
  ) {
    return null;
  }

  if (submitterText.includes("lösch") || submitterText.includes("loesch")) {
    return {
      done: "Gelöscht.",
      pending: "Wird gelöscht...",
    };
  }

  if (submitterText.includes("kopier")) {
    return {
      done: "Kopiert.",
      pending: "Wird kopiert...",
    };
  }

  if (submitterText.includes("speicher")) {
    return {
      done: "Gespeichert.",
      pending: "Wird gespeichert...",
    };
  }

  if (method === "post") {
    return {
      done: "Aktion wurde ausgeführt.",
      pending: "Aktion wird ausgeführt...",
    };
  }

  return null;
}

export function GlobalFormFeedback() {
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const storedFeedback = window.sessionStorage.getItem(storedFeedbackKey);

    if (storedFeedback) {
      window.sessionStorage.removeItem(storedFeedbackKey);
      window.setTimeout(() => {
        setFeedback({
          text: storedFeedback,
          tone: "success",
        });
      }, 0);
    }
  }, []);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(
      () => setFeedback(null),
      feedback.tone === "pending" ? 1600 : 3600,
    );

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [feedback]);

  useEffect(() => {
    function handleSubmit(event: SubmitEvent) {
      const form = event.target;

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      if (form.dataset.feedback === "off") {
        return;
      }

      const submitter =
        event.submitter instanceof HTMLElement ? event.submitter : null;
      const feedbackTexts = getFeedbackTexts(form, submitter);

      if (!feedbackTexts) {
        return;
      }

      window.sessionStorage.setItem(storedFeedbackKey, feedbackTexts.done);
      setFeedback({
        text: feedbackTexts.pending,
        tone: "pending",
      });

      window.setTimeout(() => {
        setFeedback({
          text: feedbackTexts.done,
          tone: "success",
        });
      }, 900);
    }

    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  if (!feedback) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-5 right-5 z-[2000] max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl ${
        feedback.tone === "pending"
          ? "border-blue-200 bg-blue-50 text-blue-950"
          : "border-green-200 bg-green-50 text-green-950"
      }`}
      role="status"
      aria-live="polite"
    >
      {feedback.text}
    </div>
  );
}
