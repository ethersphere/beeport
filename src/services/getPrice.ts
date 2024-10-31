import { URL_FETCH_PRICE_API } from "@/constants";

export const getPrice = async (): Promise<number | undefined> => {
  try {
    const response = await fetch(
      URL_FETCH_PRICE_API
    );
    if (!response.ok) throw new Error("Network response was not ok");
    const data = await response.json();
    if (data.events && data.events.length > 0) {
      return parseFloat(data.events[0].data.price)
    } else {
      console.error("No price update available.");
    }
  } catch (error) {
    console.error("Error fetching price:", error);
  }
};