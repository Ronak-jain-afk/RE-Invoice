import { useState, useEffect, useRef } from "react";
import dayjs from "dayjs";

export function useDate() {
  const [date, setDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    fetch("https://worldtimeapi.org/api/ip", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.datetime) {
          setDate(dayjs(data.datetime).format("YYYY-MM-DD"));
          fetchedRef.current = true;
        }
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        if (!fetchedRef.current) {
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