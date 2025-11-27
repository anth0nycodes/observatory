import { tool } from "ai";
import { z } from "zod";

const locations = ["Tampa", "San Francisco", "New York", "London", "Tokyo", "Sydney"];

const mockWeather: Record<
  string,
  { temp: number; condition: string; humidity: number }
> = {
  "Tampa": { temp: 80, condition: "Sunny", humidity: 77 },
  "San Francisco": { temp: 62, condition: "Foggy", humidity: 75 },
  "New York": { temp: 45, condition: "Cloudy", humidity: 60 },
  "London": { temp: 52, condition: "Rainy", humidity: 85 },
  "Tokyo": { temp: 68, condition: "Sunny", humidity: 55 },
  "Sydney": { temp: 75, condition: "Clear", humidity: 50 },
};

export const weatherTools = {
  getLocation: tool({
    description: "Get a random location to check weather for",
    inputSchema: z.object({}),
    execute: async () => {
      const location =
        locations[Math.floor(Math.random() * locations.length)];
      return { location };
    },
  }),
  getWeather: tool({
    description: "Get current weather for a specific location",
    inputSchema: z.object({
      location: z.string().describe("City name"),
    }),
    execute: async ({ location }) => {
      const weather = mockWeather[location];
      if (!weather) {
        return {
          error:
            "Location not found. Try: Tampa, San Francisco, New York, London, Tokyo, or Sydney",
        };
      }
      return { location, ...weather };
    },
  }),
};
