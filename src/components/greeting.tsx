"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function Greeting() {
  const t = useTranslations("home");
  const [key, setKey] = useState<"greetingMorning" | "greetingAfternoon" | "greetingEvening">(
    "greetingMorning",
  );

  useEffect(() => {
    const h = new Date().getHours();
    setKey(h < 12 ? "greetingMorning" : h < 18 ? "greetingAfternoon" : "greetingEvening");
  }, []);

  return <>{t(key)}</>;
}
