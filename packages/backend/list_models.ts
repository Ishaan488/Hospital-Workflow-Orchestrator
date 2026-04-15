import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

async function run() {
  const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || "");
  // The SDK might not have a public listModels method in this version, let\''s try the REST API
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
run().catch(console.error);
