import { useState } from "react";
import dayjs from "dayjs";

export function useDate() {
  const [date, setDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  return { date, setDate, isLoading: false };
}