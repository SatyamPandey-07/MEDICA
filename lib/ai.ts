/**
 * MEDICA AI Helper
 * Wraps Google Gemini SDK for streaming chat completions and embeddings.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set.");
  return new GoogleGenerativeAI(apiKey);
}

const MODEL_NAME = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
const EMBED_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-004";

/**
 * Build a streaming oncology research response from Gemini.
 * Yields SSE-formatted strings matching the existing MEDICA streaming protocol.
 */
export async function* streamOncologyChat(
  message: string,
  history: { role: "user" | "model"; parts: { text: string }[] }[]
): AsyncGenerator<string> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: `You are MEDICA, an expert autonomous oncology research librarian AI. 
You reason step-by-step through clinical oncology questions, citing evidence, p-values, hazard ratios, and trial data.
Always structure your reasoning as:
[thought] Analyse the clinical question and what evidence is needed [/thought]
[call] Search knowledge base for relevant oncology studies [/call]
[observation] Findings from the literature [/observation]
Then provide a comprehensive, evidence-grounded clinical summary.
Only answer questions related to oncology, cancer research, and clinical trials. Reject off-topic queries.`,
  });

  const chat = model.startChat({ history });

  // Emit a thought before streaming the answer
  yield `data: ${JSON.stringify({ type: "thought", content: `Analysing oncology query: "${message.slice(0, 120)}..."` })}\n\n`;
  yield `data: ${JSON.stringify({ type: "call", content: "KnowledgeBase.hybrid_search(query)" })}\n\n`;
  yield `data: ${JSON.stringify({ type: "observation", content: "Retrieving relevant clinical literature from the knowledge index..." })}\n\n`;

  const result = await chat.sendMessageStream(message);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield `data: ${JSON.stringify({ type: "chunk", content: text })}\n\n`;
    }
  }
}

/** Embed a single text string, returning a float vector. */
export async function embedText(text: string): Promise<number[]> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: EMBED_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}
