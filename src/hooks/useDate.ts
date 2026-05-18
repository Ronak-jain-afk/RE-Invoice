import { useState, useEffect } from "react";
import dayjs from "dayjs";

export function useDate() {
  const [date, setDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    fetch("https://worldtimeapi.org/api/ip", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.datetime) {
          setDate(dayjs(data.datetime).format("YYYY-MM-DD"));
        }
      })
      .catch(() => {
        // fallback to system clock
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!date) {
          setDate(dayjs().format("YYYY-MM-DD"));
        }
        setIsLoading(false);
      });
  }, []);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
  };

  return { date, setDate: handleDateChange, isLoading };
}